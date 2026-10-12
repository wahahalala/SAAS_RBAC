import {
    Injectable,
    Logger,
    NotFoundException,
    ConflictException,
    ForbiddenException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { CacheService } from "@/modules/redis/cache.service";
import { RedisKeys } from "@/modules/redis/keys";
import { EmailQueueService } from "@/modules/queue";
import { DomainEventsService } from "@/modules/events";
import { TenantContext } from "@/modules/tenant";
import {
    CreateOrganizationDto,
    UpdateOrganizationDto,
    InviteMemberDto,
} from "./dto";
import type { Role } from "@saas/shared-types";

/** Shape returned for an organization, as seen from one tenant. */
export interface OrganizationView {
    id: string;
    tenantId: string;
    name: string;
    slug: string;
    logo: string | null;
    memberCount: number;
    plan: string;
    createdAt: Date;
}

const ADMIN_ROLE_KEY = "admin";
const MEMBER_ROLE_KEY = "member";
const ORGANIZATION_CACHE_TTL_SECONDS = 120;

/** How long an invitation stays acceptable. */
const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class OrganizationsService {
    private readonly logger = new Logger(OrganizationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly tenantContext: TenantContext,
        private readonly configService: ConfigService,
        private readonly emailQueue: EmailQueueService,
        private readonly domainEvents: DomainEventsService,
    ) { }

    /**
     * Resolve a tenant-scoped role by key, falling back to the global system
     * role definition and creating a tenant copy when missing.
     */
    private async getRoleByKey(
        tenantId: string,
        key: typeof ADMIN_ROLE_KEY | typeof MEMBER_ROLE_KEY,
    ) {
        const role = await this.prisma.role.findFirst({
            where: { tenantId, key },
        });

        if (role) {
            return role;
        }

        const globalRole = await this.prisma.role.findFirst({
            where: { tenantId: null, key },
        });

        const created = await this.prisma.role.create({
            data: {
                tenantId,
                key,
                name: globalRole?.name ?? key,
                description: globalRole?.description ?? null,
                isSystem: globalRole?.isSystem ?? false,
            },
        });

        // A tenant role starts with NO permissions of its own. PermissionGuard
        // resolves the caller's permissions from the TENANT role, so without
        // copying the global role's grants a freshly provisioned tenant's admin
        // would hold nothing — unable to invite members or export reports.
        await this.copyRolePermissions(globalRole?.id, created.id, this.prisma);

        return created;
    }

    /**
     * Create a new organization (and its backing Tenant).
     */
    async create(userId: string, dto: CreateOrganizationDto) {
        const slug = dto.slug || this.generateSlug(dto.name);

        const existing = await this.prisma.organization.findUnique({
            where: { slug },
        });

        if (existing) {
            throw new ConflictException("Organization slug already exists");
        }

        let tenantId = "";

        await this.prisma.$transaction(async (tx) => {
            // 1. Backing tenant.
            const tenant = await tx.tenant.create({
                data: {
                    name: dto.name,
                    slug,
                    plan: "free",
                    status: "active",
                },
            });
            tenantId = tenant.id;

            // 2. Compatibility organization (1:1 with tenant).
            await tx.organization.create({
                data: {
                    tenantId: tenant.id,
                    name: dto.name,
                    slug,
                    logo: dto.logo,
                },
            });

            // 3. Default subscription.
            await tx.subscription.create({
                data: {
                    tenantId: tenant.id,
                    plan: "free",
                    status: "active",
                },
            });

            // 4. Admin role for this tenant.
            const adminRole = await this.getTenantRoleTx(tx, tenant.id, ADMIN_ROLE_KEY);

            // 5. Add creator as admin member.
            await tx.membership.create({
                data: {
                    tenantId: tenant.id,
                    userId,
                    roleId: adminRole.id,
                },
            });
        });

        // Emitted after the transaction committed: a rolled-back provisioning
        // must not have announced a tenant.
        this.domainEvents.tenantCreated({
          tenantId,
          actorId: userId,
          tenantName: dto.name,
          tenantSlug: slug,
          ownerId: userId,
        });

        // Read the row back for the response. This must NOT go through
        // findBySlug(): that resolves the slug within the CALLER's tenant
        // context, and provisioning runs with no tenant yet (the whole point
        // of this operation), so it would fail with "Tenant context is
        // required". The slug was just created here, so read it directly.
        const created = await this.prisma.organization.findFirstOrThrow({
            where: { tenantId, slug },
            include: {
                tenant: {
                    include: {
                        memberships: true,
                        subscriptions: true,
                    },
                },
            },
        });

        return this.formatOrganization(created);
    }

    /**
     * Same as getRoleByKey but inside a transaction client.
     */
    private async getTenantRoleTx(
        tx: Prisma.TransactionClient,
        tenantId: string,
        key: string,
    ) {
        const role = await tx.role.findFirst({
            where: { tenantId, key },
        });

        if (role) {
            return role;
        }

        const globalRole = await tx.role.findFirst({
            where: { tenantId: null, key },
        });

        const created = await tx.role.create({
            data: {
                tenantId,
                key,
                name: globalRole?.name ?? key,
                description: globalRole?.description ?? null,
                isSystem: globalRole?.isSystem ?? false,
            },
        });

        // Same reasoning as getRoleByKey: a tenant role with no grants would
        // leave the provisioned tenant's admin unable to do anything.
        await this.copyRolePermissions(globalRole?.id, created.id, tx);

        return created;
    }

    /**
     * Copy a global role's permission grants onto a tenant-scoped copy.
     *
     * A tenant role is created with NO grants of its own, but PermissionGuard
     * resolves permissions from the TENANT role — so without this a freshly
     * provisioned tenant's admin holds nothing (no invites, no reports).
     *
     * Accepts either client so provisioning (inside its transaction) and later
     * role creation behave identically.
     */
    private async copyRolePermissions(
        sourceRoleId: string | undefined,
        targetRoleId: string,
        client: Prisma.TransactionClient,
    ): Promise<void> {
        if (!sourceRoleId) return;

        const grants = await client.rolePermission.findMany({
            where: { roleId: sourceRoleId },
            select: { permissionId: true },
        });

        if (grants.length === 0) return;

        await client.rolePermission.createMany({
            data: grants.map((grant) => ({
                roleId: targetRoleId,
                permissionId: grant.permissionId,
            })),
            // Unique constraint is (roleId, permissionId); re-running the
            // resolver must not fail on an existing grant.
            skipDuplicates: true,
        });
    }

    /**
     * Get organization by slug (cached).
     *
     * The cache key includes the caller's tenant so the entry can never be
     * served across tenants (slug is globally unique today, but the cached
     * payload is a tenant view — memberships, plan — so it must be namespaced
     * by tenant like every other tenant-scoped cache).
     */
    async findBySlug(slug: string): Promise<OrganizationView> {
        const tenantId = this.requireTenantId();

        const key = RedisKeys.organizationBySlug(tenantId, slug);
        const cached = await this.cacheService.get<OrganizationView>(key);
        if (cached) {
            return cached;
        }

        const organization = await this.findBySlugInTenant(slug);
        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        await this.cacheService.set(
            key,
            organization,
            ORGANIZATION_CACHE_TTL_SECONDS,
        );
        return organization;
    }

    /**
     * Resolve a slug the way a REQUEST must resolve it: the slug has to belong
     * to the tenant the request is authorised for.
     *
     * Slugs are globally unique, so looking an organization up by slug alone
     * ignores `X-Tenant-Id` entirely. Returns null when the slug belongs to
     * another tenant — callers turn that into a 404/403.
     */
    async findBySlugInTenant(slug: string): Promise<OrganizationView | null> {
        const tenantId = this.requireTenantId();

        const organization = await this.prisma.organization.findFirst({
            where: { slug, tenantId },
            include: {
                tenant: {
                    include: {
                        memberships: true,
                        subscriptions: true,
                    },
                },
            },
        });

        return organization ? this.formatOrganization(organization) : null;
    }

    /**
     * The tenant this request is scoped to, or an error.
     *
     * Fails closed: without a tenant context there is nothing to scope a query
     * by, and defaulting to "any tenant" would defeat isolation.
     */
    private requireTenantId(): string {
        const tenantId = this.tenantContext.getTenantId();
        if (!tenantId) {
            throw new ForbiddenException(
                "Tenant context is required for this operation",
            );
        }
        return tenantId;
    }

    /**
     * Update organization.
     */
    async update(slug: string, dto: UpdateOrganizationDto) {
        const organization = await this.prisma.organization.update({
            where: { slug },
            data: {
                name: dto.name,
                logo: dto.logo,
            },
            include: {
                tenant: {
                    include: {
                        memberships: true,
                        subscriptions: true,
                    },
                },
            },
        });

        // Keep the tenant name in sync.
        if (dto.name) {
            await this.prisma.tenant.update({
                where: { id: organization.tenantId },
                data: { name: dto.name },
            });
        }

        return this.formatOrganization(organization);
    }

    /**
     * Delete organization (cascades the backing tenant).
     */
    async delete(slug: string) {
        await this.prisma.organization.delete({
            where: { slug },
        });
    }

    /**
     * Get organization members.
     */
    async getMembers(slug: string) {
        const organization = await this.prisma.organization.findUnique({
            where: { slug },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        const members = await this.prisma.membership.findMany({
            where: { tenantId: organization.tenantId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        image: true,
                    },
                },
                role: true,
            },
            orderBy: { createdAt: "asc" },
        });

        return members.map((m) => ({
            id: m.id,
            userId: m.userId,
            role: m.role.key,
            user: m.user,
            createdAt: m.createdAt,
        }));
    }

    /**
     * Check if user is a member of the organization addressed by `slug`
     * WITHIN THE TENANT THIS REQUEST IS SCOPED TO.
     *
     * Both halves matter: the slug must belong to the request's tenant (so a
     * caller cannot bring Tenant A's `X-Tenant-Id` and operate Tenant B's
     * organization), and the user must hold a Membership in it.
     *
     * Returns a shape compatible with the old `OrganizationMember` result:
     * it exposes `role` as the role KEY (e.g. "admin" | "member") so
     * controller-level checks keep working. Returns null when the slug is not
     * in this tenant (callers must not distinguish that from "not a member").
     */
    async getMembership(userId: string, slug: string) {
        const tenantId = this.requireTenantId();

        const organization = await this.prisma.organization.findFirst({
            where: { slug, tenantId },
        });

        if (!organization) {
            return null;
        }

        const membership = await this.prisma.membership.findUnique({
            where: {
                tenantId_userId: {
                    tenantId: organization.tenantId,
                    userId,
                },
            },
            include: { role: true },
        });

        if (!membership) {
            return null;
        }

        return {
            id: membership.id,
            userId: membership.userId,
            role: membership.role.key,
            createdAt: membership.createdAt,
            organization: {
                id: organization.id,
                tenantId: organization.tenantId,
                slug: organization.slug,
            },
        };
    }

    /**
     * Same contract as getMembership(), named for call sites that make the
     * tenant binding explicit.
     */
    async getMembershipForRequest(userId: string, slug: string) {
        return this.getMembership(userId, slug);
    }

    /**
     * Invite a new member.
     */
    async inviteMember(slug: string, inviterId: string, dto: InviteMemberDto) {
        const tenantId = this.requireTenantId();

        // Address the organization THROUGH the request's tenant, so a slug
        // from another tenant can never be invited into.
        const organization = await this.prisma.organization.findFirst({
            where: { slug, tenantId },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        // Emails are compared case-insensitively everywhere else (auth lower-
        // cases on register/login), so normalise here too — otherwise
        // "John@x.com" would slip past the duplicate checks below.
        const email = dto.email.trim().toLowerCase();

        const existingUser = await this.prisma.user.findUnique({
            where: { email },
        });

        if (existingUser) {
            const existingMember = await this.prisma.membership.findUnique({
                where: {
                    tenantId_userId: {
                        tenantId: organization.tenantId,
                        userId: existingUser.id,
                    },
                },
            });

            if (existingMember) {
                throw new ConflictException("User is already a member");
            }
        }

        // Only a still-pending, unexpired invitation blocks a new one.
        const existingInvite = await this.prisma.invitation.findFirst({
            where: {
                email,
                tenantId: organization.tenantId,
                status: "pending",
                expiresAt: { gt: new Date() },
            },
        });

        if (existingInvite) {
            throw new ConflictException("Invitation already pending");
        }

        const roleKey = dto.role as Role;
        const role = await this.getRoleByKey(organization.tenantId, roleKey);

        const expiresAt = new Date(Date.now() + INVITATION_TTL_MS);

        const invitation = await this.prisma.invitation.create({
            data: {
                tenantId: organization.tenantId,
                email,
                roleId: role.id,
                roleKey: role.key,
                invitedById: inviterId,
                invitedByOrgId: organization.id,
                expiresAt,
            },
        });

        // Hand the email off to the worker via BullMQ. Enqueueing must not
        // undo the invitation: if Redis is unavailable the invitation still
        // exists and the admin can retry, so the failure is logged, not thrown.
        const inviter = await this.prisma.user.findUnique({
            where: { id: inviterId },
            select: { name: true, email: true },
        });

        try {
            await this.emailQueue.enqueueInviteEmail({
                to: invitation.email,
                inviterName: inviter?.name ?? inviter?.email ?? "A teammate",
                organizationName: organization.name,
                inviteToken: invitation.token,
                inviteUrl: this.buildInviteUrl(invitation.token),
            });
        } catch (error) {
            this.logger.error(
                `Invitation ${invitation.id} created but its email could not be queued: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }

        return invitation;
    }

    /** Absolute accept link the invited user opens in the browser. */
    private buildInviteUrl(token: string): string {
        const base = (
            this.configService.get<string>("FRONTEND_URL") ||
            "http://localhost:3000"
        ).replace(/\/+$/, "");

        return `${base}/invitations/${token}`;
    }

    /**
     * Update member role.
     */
    async updateMemberRole(
        slug: string,
        memberId: string,
        roleKey: "admin" | "member",
        /**
         * Who performed the change. Distinct from the member being changed —
         * the audit row must name the actor, not the target.
         */
        actorId?: string,
    ) {
        const tenantId = this.requireTenantId();

        // Scoped to the request's tenant: a slug from another tenant must not be
        // reachable here (same reasoning as findBySlugInTenant).
        const organization = await this.prisma.organization.findFirst({
            where: { slug, tenantId },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        // Read the current role up front: the event reports the transition, and
        // after the update the previous value is gone.
        const existing = await this.prisma.membership.findFirst({
            where: { id: memberId, tenantId: organization.tenantId },
            include: { role: true },
        });

        if (!existing) {
            throw new NotFoundException("Member not found");
        }

        const previousRoleKey = existing.role.key;

        if (roleKey === MEMBER_ROLE_KEY) {
            const member = existing;

            if (member?.role.key === ADMIN_ROLE_KEY) {
                const adminCount = await this.prisma.membership.count({
                    where: {
                        tenantId: organization.tenantId,
                        role: { key: ADMIN_ROLE_KEY },
                    },
                });

                if (adminCount === 1) {
                    throw new ForbiddenException(
                        "Cannot remove the last admin. Transfer admin rights first.",
                    );
                }
            }
        }

        const role = await this.getRoleByKey(organization.tenantId, roleKey);

        const updated = await this.prisma.membership.update({
            where: { id: memberId },
            data: { roleId: role.id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true,
                        image: true,
                    },
                },
                role: true,
            },
        });

        // Invalidate the tenant's RBAC permission cache (role changed).
        await this.cacheService.invalidateTenant(organization.tenantId);

        // Only emit a real transition: re-assigning the same role is a no-op and
        // would otherwise produce audit noise.
        if (previousRoleKey !== updated.role.key) {
            this.domainEvents.roleChanged({
                tenantId: organization.tenantId,
                actorId,
                membershipId: updated.id,
                targetUserId: updated.userId,
                previousRoleKey,
                newRoleKey: updated.role.key,
            });
        }

        return updated;
    }

    /**
     * Remove member from organization.
     */
    async removeMember(slug: string, memberId: string) {
        const organization = await this.prisma.organization.findUnique({
            where: { slug },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        const member = await this.prisma.membership.findUnique({
            where: { id: memberId },
            include: { role: true },
        });

        if (member?.role.key === ADMIN_ROLE_KEY) {
            const adminCount = await this.prisma.membership.count({
                where: {
                    tenantId: organization.tenantId,
                    role: { key: ADMIN_ROLE_KEY },
                },
            });

            if (adminCount === 1) {
                throw new ForbiddenException(
                    "Cannot remove the last admin. Transfer admin rights first.",
                );
            }
        }

        // Cross-tenant guard: the member must belong to THIS tenant.
        if (member && member.tenantId !== organization.tenantId) {
            throw new ForbiddenException(
                "Cannot remove a member from another tenant.",
            );
        }

        await this.prisma.membership.delete({
            where: { id: memberId },
        });
    }

    /**
     * Tenant settings cache (Use case 2).
     *
     * Read from Redis first; on miss, read the Tenant and populate the cache.
     * Invalidation: `updateTenantSettings` and any org update call
     * `invalidateTenantSettings`.
     */
    async getTenantSettings(tenantId: string): Promise<Record<string, unknown> | null> {
        const key = RedisKeys.settings(tenantId);
        const cached = await this.cacheService.get<Record<string, unknown>>(key);
        if (cached) {
            return cached;
        }

        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            select: { settings: true },
        });

        const settings = (tenant?.settings ?? null) as Record<string, unknown> | null;
        if (settings) {
            await this.cacheService.set(key, settings);
        }
        return settings;
    }

    async updateTenantSettings(
        tenantId: string,
        settings: Prisma.InputJsonValue,
    ): Promise<void> {
        await this.prisma.tenant.update({
            where: { id: tenantId },
            data: { settings },
        });
        // Invalidate the cached value so the next read fetches fresh data.
        await this.invalidateTenantSettings(tenantId);
    }

    async invalidateTenantSettings(tenantId: string): Promise<void> {
        await this.cacheService.invalidate(RedisKeys.settings(tenantId));
    }

    // Helper methods
    private generateSlug(name: string): string {
        return name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");
    }

    private formatOrganization(org: any) {
        const tenant = org?.tenant;
        return {
            id: org.id,
            // Client-facing tenant scope (X-Tenant-Id header value).
            tenantId: org.tenantId,
            name: org.name,
            slug: org.slug,
            logo: org.logo,
            memberCount: tenant?.memberships?.length ?? 0,
            plan: tenant?.subscriptions?.[0]?.plan ?? "free",
            createdAt: org.createdAt,
        };
    }
}

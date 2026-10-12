import {
    Injectable,
    NotFoundException,
    ConflictException,
    ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { CacheService } from "@/modules/redis/cache.service";
import { RedisKeys } from "@/modules/redis/keys";
import { TenantContext } from "@/modules/tenant";
import {
    CreateOrganizationDto,
    UpdateOrganizationDto,
    InviteMemberDto,
} from "./dto";
import type { Role } from "@saas/shared-types";

const ADMIN_ROLE_KEY = "admin";
const MEMBER_ROLE_KEY = "member";
const ORGANIZATION_CACHE_TTL_SECONDS = 120;

@Injectable()
export class OrganizationsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly tenantContext: TenantContext,
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

        return this.prisma.role.create({
            data: {
                tenantId,
                key,
                name: globalRole?.name ?? key,
                description: globalRole?.description ?? null,
                isSystem: globalRole?.isSystem ?? false,
            },
        });
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

        return this.formatOrganization(await this.findBySlug(slug));
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

        return tx.role.create({
            data: {
                tenantId,
                key,
                name: globalRole?.name ?? key,
                description: globalRole?.description ?? null,
                isSystem: globalRole?.isSystem ?? false,
            },
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
    async findBySlug(slug: string) {
        const tenantId = this.tenantContext.getTenantId();
        if (!tenantId) {
            // No tenant context: skip the cache instead of writing to a shared key.
            return this.findBySlugUncached(slug);
        }

        const key = `${RedisKeys.organizationBySlug(tenantId)}:${slug}`;
        const cached = await this.cacheService.get<ReturnType<typeof this.formatOrganization>>(key);
        if (cached) {
            return cached;
        }

        const organization = await this.findBySlugUncached(slug);
        await this.cacheService.set(key, organization, ORGANIZATION_CACHE_TTL_SECONDS);
        return organization;
    }

    private async findBySlugUncached(slug: string) {
        const organization = await this.prisma.organization.findUnique({
            where: { slug },
            include: {
                tenant: {
                    include: {
                        memberships: true,
                        subscriptions: true,
                    },
                },
            },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        return this.formatOrganization(organization);
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
     * Check if user is a member of the organization.
     *
     * Returns a shape compatible with the old `OrganizationMember` result:
     * it exposes `role` as the role KEY (e.g. "admin" | "member") so
     * controller-level checks keep working.
     */
    async getMembership(userId: string, slug: string) {
        const organization = await this.prisma.organization.findUnique({
            where: { slug },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
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
        };
    }

    /**
     * Invite a new member.
     */
    async inviteMember(slug: string, inviterId: string, dto: InviteMemberDto) {
        const organization = await this.prisma.organization.findUnique({
            where: { slug },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        const existingUser = await this.prisma.user.findUnique({
            where: { email: dto.email },
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

        const existingInvite = await this.prisma.invitation.findFirst({
            where: {
                email: dto.email,
                tenantId: organization.tenantId,
                expiresAt: { gt: new Date() },
            },
        });

        if (existingInvite) {
            throw new ConflictException("Invitation already pending");
        }

        const roleKey = dto.role as Role;
        const role = await this.getRoleByKey(organization.tenantId, roleKey);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        const invitation = await this.prisma.invitation.create({
            data: {
                tenantId: organization.tenantId,
                email: dto.email,
                roleId: role.id,
                roleKey: role.key,
                invitedById: inviterId,
                invitedByOrgId: organization.id,
                expiresAt,
            },
        });

        // TODO: Send invitation email

        return invitation;
    }

    /**
     * Update member role.
     */
    async updateMemberRole(
        slug: string,
        memberId: string,
        roleKey: "admin" | "member",
    ) {
        const organization = await this.prisma.organization.findUnique({
            where: { slug },
        });

        if (!organization) {
            throw new NotFoundException("Organization not found");
        }

        if (roleKey === MEMBER_ROLE_KEY) {
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

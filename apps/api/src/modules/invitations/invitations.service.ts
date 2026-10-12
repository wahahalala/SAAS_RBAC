import {
    BadRequestException,
    GoneException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { CacheService } from "@/modules/redis/cache.service";
import { RedisKeys } from "@/modules/redis/keys";
import { effectiveStatus } from "./invitation-lifecycle";
import type {
    AcceptInvitationResponse,
    InvitationPreviewResponse,
    InvitationStatus,
    InvitationSummaryResponse,
} from "@saas/shared-types";

/**
 * Invitation accept / preview / revoke.
 *
 * Scope note: an invitation token is the credential. Per the agreed design the
 * token alone authorises acceptance — the accepting account's email is NOT
 * required to match the invited address. Preview is public (the link must be
 * openable before signing in) and therefore exposes only display data.
 */
@Injectable()
export class InvitationsService {
    private readonly logger = new Logger(InvitationsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    /**
     * Public preview for the accept page.
     *
     * Resolves the token, applies lazy expiry, and reports whether an account
     * already exists for the invited email (so the UI can offer "sign in" vs
     * "sign up"). Never reveals the token or internal ids.
     */
    async preview(token: string): Promise<InvitationPreviewResponse> {
        const invitation = await this.loadByToken(token);

        const [account, tenant] = await Promise.all([
            this.prisma.user.findUnique({
                where: { email: invitation.email },
                select: { id: true },
            }),
            this.prisma.tenant.findUnique({
                where: { id: invitation.tenantId },
                include: { organization: true },
            }),
        ]);

        return {
            email: invitation.email,
            organizationName: tenant?.name ?? "the organization",
            // Organization.slug is the URL identity; Tenant.slug is a separate
            // field and must not be presented as the organization's slug.
            organizationSlug:
                tenant?.organization?.slug ?? tenant?.slug ?? "",
            role: invitation.roleKey,
            invitedByName: invitation.invitedBy?.name ?? null,
            status: effectiveStatus(invitation),
            expiresAt: invitation.expiresAt,
            accountExists: Boolean(account),
        };
    }

    /**
     * Accept an invitation: create the Membership that the invitation promised.
     *
     * Idempotent — if the caller is already a member the existing membership is
     * returned instead of failing, because a double-clicked accept button (or a
     * second browser tab) must not look like an error.
     */
    async accept(
        token: string,
        userId: string,
    ): Promise<AcceptInvitationResponse> {
        const invitation = await this.loadByToken(token);

        const status = effectiveStatus(invitation);
        if (status === "expired") {
            // Persist the transition so admin lists agree with what the user saw.
            await this.markExpired(invitation.id);
            throw new GoneException("Invitation has expired");
        }
        if (status === "accepted") {
            // Idempotent ONLY for the account that already accepted: a
            // double-click, a refresh, or a second tab must not look like an
            // error. Anybody else holding the link is refused — the token is
            // single-use, and the accepted-by record is what makes that
            // distinguishable from a repeat accept by the same user.
            if (invitation.acceptedById === userId) {
                return this.acceptResponse(
                    invitation,
                    await this.loadTenantOrThrow(invitation.tenantId),
                    invitation.roleKey,
                    true,
                );
            }
            throw new BadRequestException(
                "Invitation has already been accepted",
            );
        }
        if (status === "canceled") {
            throw new BadRequestException("Invitation was canceled");
        }

        const tenant = await this.prisma.tenant.findUnique({
            where: { id: invitation.tenantId },
            include: { organization: true },
        });

        if (!tenant) {
            throw new NotFoundException("Organization no longer exists");
        }

        // The role is re-resolved at accept time: the invitation stores a role
        // KEY, and the tenant's role row may have been created/replaced since.
        const role = await this.resolveRole(invitation.tenantId, invitation.roleKey);

        const existing = await this.prisma.membership.findUnique({
            where: {
                tenantId_userId: { tenantId: invitation.tenantId, userId },
            },
            include: { role: true },
        });

        if (existing) {
            // Already a member (e.g. invited twice, or re-added directly):
            // record the accept instead of failing on the unique constraint.
            await this.markAccepted(invitation.id, userId);
            return this.acceptResponse(invitation, tenant, existing.role.key, true);
        }

        const membership = await this.prisma.membership.create({
            data: {
                tenantId: invitation.tenantId,
                userId,
                roleId: role.id,
            },
            include: { role: true },
        });

        await this.markAccepted(invitation.id, userId);

        // The new member's permission set must not be served from a stale cache
        // entry written before this membership existed.
        await this.cacheService.invalidate(
            RedisKeys.permissions(invitation.tenantId, userId),
        );

        this.logger.log(
            `User ${userId} accepted invitation ${invitation.id} into tenant ${invitation.tenantId}`,
        );

        return this.acceptResponse(
            invitation,
            tenant,
            membership.role.key,
            false,
        );
    }

    /**
     * Invitations issued for a tenant (admin view).
     *
     * Also flips stale `pending` rows that are past `expiresAt` so the returned
     * status matches the lazy rule applied elsewhere.
     */
    async listForTenant(tenantId: string): Promise<InvitationSummaryResponse[]> {
        const invitations = await this.prisma.invitation.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
            include: {
                invitedBy: { select: { id: true, name: true, email: true } },
            },
        });

        const stale = invitations.filter(
            (invitation) => effectiveStatus(invitation) === "expired",
        );

        if (stale.length > 0) {
            await this.prisma.invitation.updateMany({
                where: { id: { in: stale.map((i) => i.id) } },
                data: { status: "expired" },
            });
        }

        return invitations.map((invitation) => ({
            id: invitation.id,
            email: invitation.email,
            // Derived, so a row that just flipped above is reported correctly.
            status: effectiveStatus(invitation),
            role: invitation.roleKey,
            expiresAt: invitation.expiresAt,
            createdAt: invitation.createdAt,
            invitedBy: invitation.invitedBy
                ? {
                      id: invitation.invitedBy.id,
                      name: invitation.invitedBy.name,
                      email: invitation.invitedBy.email,
                  }
                : null,
        }));
    }

    /**
     * Revoke a pending invitation (admin action).
     *
     * Only `pending` invitations can be canceled — an accepted one is already a
     * membership (remove the member instead) and re-canceling is a no-op.
     */
    async cancel(token: string): Promise<{ id: string; status: "canceled" }> {
        const invitation = await this.loadByToken(token);
        return this.cancelLoaded(invitation);
    }

    /**
     * Revoke by invitation id, scoped to a tenant.
     *
     * The admin route addresses invitations by id, so the tenant check must be
     * part of the query — otherwise an admin of tenant A could revoke tenant
     * B's invitation by passing its id.
     */
    async cancelById(
        invitationId: string,
        tenantId: string,
    ): Promise<{ id: string; status: "canceled" }> {
        const invitation = await this.prisma.invitation.findFirst({
            where: { id: invitationId, tenantId },
        });

        if (!invitation) {
            throw new NotFoundException("Invitation not found");
        }

        return this.cancelLoaded(invitation);
    }

    private async cancelLoaded(invitation: {
        id: string;
        status: InvitationStatus | string;
        expiresAt: Date;
    }): Promise<{ id: string; status: "canceled" }> {
        const status = effectiveStatus(invitation);

        if (status === "canceled") {
            return { id: invitation.id, status: "canceled" };
        }
        if (status !== "pending") {
            throw new BadRequestException(
                `Cannot cancel an invitation that is ${status}`,
            );
        }

        await this.prisma.invitation.update({
            where: { id: invitation.id },
            data: { status: "canceled" },
        });

        return { id: invitation.id, status: "canceled" };
    }

    // ---------------------------------------------------------------- helpers

    private async loadByToken(token: string) {
        if (!token) {
            throw new BadRequestException("Invitation token is required");
        }

        const invitation = await this.prisma.invitation.findUnique({
            where: { token },
            include: {
                invitedBy: { select: { id: true, name: true, email: true } },
            },
        });

        if (!invitation) {
            throw new NotFoundException("Invitation not found");
        }

        return invitation;
    }

    private async markExpired(id: string): Promise<void> {
        await this.prisma.invitation.updateMany({
            where: { id, status: "pending" },
            data: { status: "expired" },
        });
    }

    /**
     * Transition to ACCEPTED and record WHO accepted.
     *
     * The acceptor is what makes a repeat accept idempotent for that user while
     * still refusing the link to everyone else.
     */
    private async markAccepted(id: string, userId: string): Promise<void> {
        await this.prisma.invitation.update({
            where: { id },
            data: {
                status: "accepted",
                acceptedById: userId,
                acceptedAt: new Date(),
            },
        });
    }

    private async loadTenantOrThrow(tenantId: string) {
        const tenant = await this.prisma.tenant.findUnique({
            where: { id: tenantId },
            include: { organization: true },
        });

        if (!tenant) {
            throw new NotFoundException("Organization no longer exists");
        }

        return tenant;
    }

    /** Resolve the tenant role for `key`, creating it if the tenant lacks it. */
    private async resolveRole(tenantId: string, key: string) {
        const role = await this.prisma.role.findFirst({
            where: { tenantId, key },
        });
        if (role) return role;

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

    private acceptResponse(
        invitation: { tenantId: string },
        tenant: {
            id: string;
            name: string;
            slug: string;
            organization: { id: string; slug: string } | null;
        },
        roleKey: string,
        alreadyMember: boolean,
    ): AcceptInvitationResponse {
        return {
            tenantId: invitation.tenantId,
            organizationId: tenant.organization?.id ?? tenant.id,
            // Organization.slug (URL identity), never Tenant.slug.
            organizationSlug: tenant.organization?.slug ?? tenant.slug,
            organizationName: tenant.name,
            role: roleKey,
            alreadyMember,
        };
    }
}

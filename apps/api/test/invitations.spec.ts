import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaService } from "@/prisma/prisma.service";
import { CacheService } from "@/modules/redis/cache.service";
import { InvitationsService } from "@/modules/invitations/invitations.service";
import { RedisKeys } from "@/modules/redis/keys";

/**
 * Invitation lifecycle over a real database:
 *
 *   PENDING ──accept──> ACCEPTED
 *      ├──expiresAt passed──> EXPIRED
 *      └──admin revoke──────> CANCELED
 *
 * Expiry is lazy, so these tests drive the clock by writing `expiresAt` in the
 * past rather than waiting.
 */

const db = new PrismaService();

function createService(invalidated: string[] = []) {
    const cacheStub = {
        get: async () => null,
        set: async () => undefined,
        invalidate: async (key: string) => {
            invalidated.push(key);
        },
        invalidatePattern: async () => 0,
        invalidateTenant: async () => 0,
    } as unknown as CacheService;

    return { service: new InvitationsService(db, cacheStub), invalidated };
}

let service: InvitationsService;
let invalidatedKeys: string[] = [];

let tenantId!: string;
let organizationId!: string;
let inviterId!: string;
let joinedUserId!: string;

const DAY_MS = 24 * 60 * 60 * 1000;

async function createInvitation(
    overrides: Partial<{
        email: string;
        expiresAt: Date;
        status: "pending" | "accepted" | "expired" | "canceled";
        token: string;
        roleKey: string;
    }> = {},
) {
    const role = await db.role.findFirstOrThrow({
        where: { tenantId, key: "member" },
    });

    return db.invitation.create({
        data: {
            tenantId,
            email: overrides.email ?? "invitee@example.com",
            roleId: role.id,
            roleKey: overrides.roleKey ?? "member",
            invitedById: inviterId,
            invitedByOrgId: organizationId,
            expiresAt: overrides.expiresAt ?? new Date(Date.now() + 7 * DAY_MS),
            status: overrides.status ?? "pending",
            token: overrides.token,
        },
    });
}

beforeAll(async () => {
    await db.$connect();
    await db.cleanDatabase();

    const tenant = await db.tenant.create({
        data: { name: "Invite Tenant", slug: "invite-tenant", plan: "free" },
    });
    tenantId = tenant.id;

    const organization = await db.organization.create({
        data: { tenantId, name: tenant.name, slug: "invite-org" },
    });
    organizationId = organization.id;

    const inviter = await db.user.create({
        data: { email: "inviter@example.com", name: "Inviter" },
    });
    inviterId = inviter.id;

    const joined = await db.user.create({
        data: { email: "joiner@example.com", name: "Joiner" },
    });
    joinedUserId = joined.id;

    const adminRole = await db.role.create({
        data: { key: "admin", name: "Admin", isSystem: true, tenantId },
    });
    const memberRole = await db.role.create({
        data: { key: "member", name: "Member", isSystem: true, tenantId },
    });

    await db.membership.create({
        data: { tenantId, userId: inviterId, roleId: adminRole.id },
    });

    expect(memberRole.id).toBeTruthy();
});

afterAll(async () => {
    await db.$disconnect();
});

beforeEach(() => {
    invalidatedKeys = [];
    const created = createService(invalidatedKeys);
    service = created.service;
});

describe("invitation preview (public)", () => {
    it("reports a pending invitation with display data and no token", async () => {
        const invitation = await createInvitation({
            email: "preview-pending@example.com",
            token: "token-preview-pending",
        });

        const preview = await service.preview(invitation.token);

        expect(preview.status).toBe("pending");
        expect(preview.email).toBe("preview-pending@example.com");
        expect(preview.organizationSlug).toBe("invite-org");
        expect(preview.invitedByName).toBe("Inviter");
        expect(preview.accountExists).toBe(false);
        // The preview payload must not leak the credential.
        expect(JSON.stringify(preview)).not.toContain(invitation.token);
    });

    it("reports accountExists for an email that already has an account", async () => {
        const invitation = await createInvitation({
            email: "joiner@example.com",
            token: "token-preview-existing",
        });

        const preview = await service.preview(invitation.token);
        expect(preview.accountExists).toBe(true);
    });

    it("reports expired once expiresAt has passed, without a scheduler", async () => {
        const invitation = await createInvitation({
            email: "preview-expired@example.com",
            token: "token-preview-expired",
            expiresAt: new Date(Date.now() - DAY_MS),
            status: "pending",
        });

        const preview = await service.preview(invitation.token);
        expect(preview.status).toBe("expired");
    });

    it("404s for an unknown token", async () => {
        await expect(service.preview("no-such-token")).rejects.toThrow(
            /not found/i,
        );
    });
});

describe("accept invitation", () => {
    it("creates a membership with the invited role and marks ACCEPTED", async () => {
        const invitation = await createInvitation({
            email: "joiner@example.com",
            token: "token-accept-happy",
        });

        const result = await service.accept(invitation.token, joinedUserId);

        expect(result.tenantId).toBe(tenantId);
        expect(result.organizationSlug).toBe("invite-org");
        expect(result.role).toBe("member");
        expect(result.alreadyMember).toBe(false);

        const membership = await db.membership.findUnique({
            where: { tenantId_userId: { tenantId, userId: joinedUserId } },
            include: { role: true },
        });
        expect(membership).not.toBeNull();
        expect(membership!.role.key).toBe("member");

        const reloaded = await db.invitation.findUniqueOrThrow({
            where: { id: invitation.id },
        });
        expect(reloaded.status).toBe("accepted");
    });

    it("drops the stale permission cache entry for the new member", async () => {
        const user = await db.user.create({
            data: { email: "cache-probe@example.com", name: "Cache Probe" },
        });
        const invitation = await createInvitation({
            email: "cache-probe@example.com",
            token: "token-accept-cache",
        });

        await service.accept(invitation.token, user.id);

        expect(invalidatedKeys).toContain(
            RedisKeys.permissions(tenantId, user.id),
        );
    });

    it("accepts without requiring the invited email to match the account", async () => {
        // Agreed design: holding the token is sufficient.
        const other = await db.user.create({
            data: { email: "different-person@example.com", name: "Different" },
        });
        const invitation = await createInvitation({
            email: "someone-else@example.com",
            token: "token-accept-mismatch",
        });

        const result = await service.accept(invitation.token, other.id);
        expect(result.alreadyMember).toBe(false);

        const membership = await db.membership.findUnique({
            where: { tenantId_userId: { tenantId, userId: other.id } },
        });
        expect(membership).not.toBeNull();
    });

    it("is idempotent: a second accept reports alreadyMember", async () => {
        const user = await db.user.create({
            data: { email: "double-click@example.com", name: "Double Click" },
        });
        const invitation = await createInvitation({
            email: "double-click@example.com",
            token: "token-accept-twice",
        });

        const first = await service.accept(invitation.token, user.id);
        expect(first.alreadyMember).toBe(false);

        // Re-accepting must not create a second membership or throw a DB error.
        const second = await service.accept(invitation.token, user.id);
        expect(second.alreadyMember).toBe(true);

        const count = await db.membership.count({
            where: { tenantId, userId: user.id },
        });
        expect(count).toBe(1);
    });

    it("rejects an expired invitation and persists EXPIRED", async () => {
        const user = await db.user.create({
            data: { email: "late@example.com", name: "Late" },
        });
        const invitation = await createInvitation({
            email: "late@example.com",
            token: "token-accept-expired",
            expiresAt: new Date(Date.now() - DAY_MS),
        });

        await expect(
            service.accept(invitation.token, user.id),
        ).rejects.toThrow(/expired/i);

        const reloaded = await db.invitation.findUniqueOrThrow({
            where: { id: invitation.id },
        });
        expect(reloaded.status).toBe("expired");

        // No membership may be created by a rejected accept.
        const membership = await db.membership.findUnique({
            where: { tenantId_userId: { tenantId, userId: user.id } },
        });
        expect(membership).toBeNull();
    });

    it("rejects an already-accepted invitation for a different user", async () => {
        const firstUser = await db.user.create({
            data: { email: "first-claimer@example.com", name: "First" },
        });
        const secondUser = await db.user.create({
            data: { email: "second-claimer@example.com", name: "Second" },
        });

        const invitation = await createInvitation({
            email: "first-claimer@example.com",
            token: "token-accept-single-use",
        });

        await service.accept(invitation.token, firstUser.id);

        await expect(
            service.accept(invitation.token, secondUser.id),
        ).rejects.toThrow(/already been accepted/i);

        const membership = await db.membership.findUnique({
            where: { tenantId_userId: { tenantId, userId: secondUser.id } },
        });
        expect(membership).toBeNull();
    });

    it("lets only the accepting user re-enter an accepted invitation", async () => {
        const accepter = await db.user.create({
            data: { email: "reenter@example.com", name: "Reenter" },
        });
        const intruder = await db.user.create({
            data: { email: "intruder@example.com", name: "Intruder" },
        });
        const invitation = await createInvitation({
            email: "reenter@example.com",
            token: "token-accept-reenter",
        });

        await service.accept(invitation.token, accepter.id);

        // Same user again (double-click / refresh): idempotent success.
        const again = await service.accept(invitation.token, accepter.id);
        expect(again.alreadyMember).toBe(true);

        // Different user on an accepted token: refused, no membership created.
        await expect(
            service.accept(invitation.token, intruder.id),
        ).rejects.toThrow(/already been accepted/i);

        const intruderMembership = await db.membership.findUnique({
            where: { tenantId_userId: { tenantId, userId: intruder.id } },
        });
        expect(intruderMembership).toBeNull();
    });

    it("records who accepted and when", async () => {
        const user = await db.user.create({
            data: { email: "acceptor-record@example.com", name: "Acceptor" },
        });
        const invitation = await createInvitation({
            email: "acceptor-record@example.com",
            token: "token-accept-record",
        });

        await service.accept(invitation.token, user.id);

        const reloaded = await db.invitation.findUniqueOrThrow({
            where: { id: invitation.id },
        });
        expect(reloaded.status).toBe("accepted");
        expect(reloaded.acceptedById).toBe(user.id);
        expect(reloaded.acceptedAt).toBeInstanceOf(Date);
    });

    it("rejects a canceled invitation", async () => {
        const user = await db.user.create({
            data: { email: "canceled@example.com", name: "Canceled" },
        });
        const invitation = await createInvitation({
            email: "canceled@example.com",
            token: "token-accept-canceled",
            status: "canceled",
        });

        await expect(
            service.accept(invitation.token, user.id),
        ).rejects.toThrow(/canceled/i);
    });
});

describe("revoke invitation", () => {
    it("cancels a pending invitation", async () => {
        const invitation = await createInvitation({
            email: "revoke-me@example.com",
            token: "token-revoke-pending",
        });

        const result = await service.cancelById(invitation.id, tenantId);
        expect(result.status).toBe("canceled");

        const reloaded = await db.invitation.findUniqueOrThrow({
            where: { id: invitation.id },
        });
        expect(reloaded.status).toBe("canceled");
    });

    it("cancels idempotently", async () => {
        const invitation = await createInvitation({
            email: "revoke-twice@example.com",
            token: "token-revoke-twice",
        });

        await service.cancelById(invitation.id, tenantId);
        const again = await service.cancelById(invitation.id, tenantId);
        expect(again.status).toBe("canceled");
    });

    it("refuses to cancel an accepted invitation", async () => {
        const user = await db.user.create({
            data: { email: "cannot-revoke@example.com", name: "Cannot Revoke" },
        });
        const invitation = await createInvitation({
            email: "cannot-revoke@example.com",
            token: "token-revoke-accepted",
        });

        await service.accept(invitation.token, user.id);

        await expect(
            service.cancelById(invitation.id, tenantId),
        ).rejects.toThrow(/Cannot cancel/i);
    });

    it("refuses to cancel an invitation owned by another tenant", async () => {
        const otherTenant = await db.tenant.create({
            data: { name: "Other Tenant", slug: "other-invite-tenant", plan: "free" },
        });

        const invitation = await createInvitation({
            email: "cross-tenant@example.com",
            token: "token-revoke-cross-tenant",
        });

        // Same invitation id, wrong tenant: must not be revocable.
        await expect(
            service.cancelById(invitation.id, otherTenant.id),
        ).rejects.toThrow(/not found/i);

        const reloaded = await db.invitation.findUniqueOrThrow({
            where: { id: invitation.id },
        });
        expect(reloaded.status).toBe("pending");
    });
});

describe("list invitations for a tenant", () => {
    it("reports effective status and flips stale pending rows", async () => {
        const stale = await createInvitation({
            email: "stale@example.com",
            token: "token-list-stale",
            expiresAt: new Date(Date.now() - DAY_MS),
        });
        const fresh = await createInvitation({
            email: "fresh@example.com",
            token: "token-list-fresh",
        });

        const listed = await service.listForTenant(tenantId);

        const staleRow = listed.find((row) => row.id === stale.id);
        const freshRow = listed.find((row) => row.id === fresh.id);

        expect(staleRow!.status).toBe("expired");
        expect(freshRow!.status).toBe("pending");

        // The transition is persisted, not only computed on read.
        const reloaded = await db.invitation.findUniqueOrThrow({
            where: { id: stale.id },
        });
        expect(reloaded.status).toBe("expired");
    });

    it("does not leak invitation tokens", async () => {
        const invitation = await createInvitation({
            email: "no-token-leak@example.com",
            token: "token-should-not-leak",
        });

        const listed = await service.listForTenant(tenantId);
        expect(JSON.stringify(listed)).not.toContain(invitation.token);
    });

    it("only lists invitations of the requested tenant", async () => {
        const otherTenant = await db.tenant.create({
            data: { name: "Isolated Tenant", slug: "isolated-invite-tenant", plan: "free" },
        });
        const otherRole = await db.role.create({
            data: { key: "member", name: "Member", isSystem: true, tenantId: otherTenant.id },
        });
        const foreign = await db.invitation.create({
            data: {
                tenantId: otherTenant.id,
                email: "foreign@example.com",
                roleId: otherRole.id,
                roleKey: "member",
                invitedById: inviterId,
                expiresAt: new Date(Date.now() + 7 * DAY_MS),
                status: "pending",
            },
        });

        const listed = await service.listForTenant(tenantId);
        expect(listed.some((row) => row.id === foreign.id)).toBe(false);
    });
});

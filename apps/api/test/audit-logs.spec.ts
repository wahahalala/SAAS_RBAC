import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaService } from "@/prisma/prisma.service";
import { AuditService } from "@/modules/audit/audit.service";
import { TenantContext } from "@/modules/tenant";
import { AUDIT_ACTIONS } from "@saas/shared-types";

/**
 * The audit query API over a real database.
 *
 * The tenant boundary and the pagination behaviour are the two things that must
 * not quietly break: a leak here exposes one tenant's activity to another, and
 * unstable ordering makes an investigation skip rows.
 */

const db = new PrismaService();
const tenantContext = new TenantContext();

let tenantId!: string;
let otherTenantId!: string;
let actorId!: string;
let otherActorId!: string;

beforeAll(async () => {
    await db.$connect();
});

afterAll(async () => {
    await db.$disconnect();
});

async function clean() {
    await db.auditLog.deleteMany();
    await db.membership.deleteMany();
    await db.role.deleteMany();
    await db.user.deleteMany();
    await db.tenant.deleteMany();
}

beforeEach(async () => {
    await clean();

    const tenant = await db.tenant.create({
        data: { name: "Audit Tenant", slug: "audit-tenant", plan: "free" },
    });
    tenantId = tenant.id;

    const other = await db.tenant.create({
        data: { name: "Other Audit", slug: "other-audit", plan: "free" },
    });
    otherTenantId = other.id;

    const actor = await db.user.create({
        data: { email: "auditor@example.com", name: "Auditor" },
    });
    actorId = actor.id;

    const otherActor = await db.user.create({
        data: { email: "elsewhere@example.com", name: "Elsewhere" },
    });
    otherActorId = otherActor.id;
});

function service() {
    return new AuditService(db, tenantContext);
}

function inTenant<T>(tenant: string, fn: () => Promise<T>): Promise<T> {
    return tenantContext.run({ tenantId: tenant }, fn);
}

async function seedEntry(overrides: Record<string, unknown> = {}) {
    return db.auditLog.create({
        data: {
            tenantId,
            userId: actorId,
            action: AUDIT_ACTIONS.LOGIN,
            entity: "User",
            entityId: actorId,
            ...overrides,
        },
    });
}

describe("listing audit logs", () => {
    it("returns the tenant's entries newest first with a user summary", async () => {
        const older = await seedEntry({
            action: AUDIT_ACTIONS.LOGIN,
            createdAt: new Date("2026-01-01T10:00:00Z"),
        });
        const newer = await seedEntry({
            action: AUDIT_ACTIONS.EXPORT_DATA,
            entity: "Report",
            entityId: "report-1",
            createdAt: new Date("2026-01-02T10:00:00Z"),
        });

        const page = await inTenant(tenantId, () => service().list({}));

        expect(page.items.map((item) => item.id)).toEqual([newer.id, older.id]);
        expect(page.meta.total).toBe(2);
        expect(page.items[0].user).toMatchObject({
            id: actorId,
            email: "auditor@example.com",
        });
    });

    it("paginates without repeating or skipping entries", async () => {
        // Same timestamp on purpose: this is what makes ordering ambiguous and
        // silently drops rows across pages if the sort key is not total.
        const sameMoment = new Date("2026-02-01T12:00:00Z");
        const created = [];
        for (let index = 0; index < 5; index += 1) {
            created.push(
                await seedEntry({
                    action: AUDIT_ACTIONS.LOGIN,
                    entityId: `session-${index}`,
                    createdAt: sameMoment,
                }),
            );
        }

        const first = await inTenant(tenantId, () =>
            service().list({ page: 1, limit: 2 }),
        );
        const second = await inTenant(tenantId, () =>
            service().list({ page: 2, limit: 2 }),
        );
        const third = await inTenant(tenantId, () =>
            service().list({ page: 3, limit: 2 }),
        );

        const seen = [...first.items, ...second.items, ...third.items].map(
            (item) => item.id,
        );

        expect(seen).toHaveLength(5);
        expect(new Set(seen).size).toBe(5);
        expect(seen.sort()).toEqual(created.map((row) => row.id).sort());

        expect(first.meta).toMatchObject({
            page: 1,
            limit: 2,
            total: 5,
            totalPages: 3,
            hasMore: true,
        });
        expect(third.meta.hasMore).toBe(false);
    });

    it("caps the page size", async () => {
        await seedEntry();

        const page = await inTenant(tenantId, () =>
            service().list({ limit: 5000 }),
        );

        // An uncapped limit is a trivial way to dump the whole table.
        expect(page.meta.limit).toBe(100);
    });

    it("treats a nonsense page number as the first page", async () => {
        await seedEntry();

        const page = await inTenant(tenantId, () =>
            service().list({ page: -3, limit: 0 }),
        );

        expect(page.meta.page).toBe(1);
        expect(page.meta.limit).toBe(1);
    });
});

describe("tenant isolation", () => {
    it("never returns another tenant's entries", async () => {
        await seedEntry({ action: AUDIT_ACTIONS.LOGIN });
        await db.auditLog.create({
            data: {
                tenantId: otherTenantId,
                userId: otherActorId,
                action: AUDIT_ACTIONS.LOGIN,
                entity: "User",
                entityId: otherActorId,
            },
        });

        const page = await inTenant(tenantId, () => service().list({}));

        expect(page.items).toHaveLength(1);
        expect(page.meta.total).toBe(1);
    });

    it("ignores a userId filter pointing at another tenant's activity", async () => {
        await seedEntry({ userId: actorId });

        // Filtering by a foreign actor must not surface their rows.
        const page = await inTenant(tenantId, () =>
            service().list({ userId: otherActorId }),
        );

        expect(page.items).toHaveLength(0);
    });

    it("excludes tenant-less entries (they have no tenant to authorise)", async () => {
        await seedEntry();
        // A registration/login before any tenant exists.
        await db.auditLog.create({
            data: {
                tenantId: null,
                userId: otherActorId,
                action: AUDIT_ACTIONS.LOGIN,
                entity: "User",
                entityId: otherActorId,
            },
        });

        const page = await inTenant(tenantId, () => service().list({}));

        expect(page.items).toHaveLength(1);
        expect(page.items[0].tenantId).toBe(tenantId);
    });

    it("fails closed without a tenant context", async () => {
        await expect(service().list({})).rejects.toThrow(
            /tenant context is required/i,
        );
    });
});

describe("filtering", () => {
    beforeEach(async () => {
        await seedEntry({
            action: AUDIT_ACTIONS.LOGIN,
            createdAt: new Date("2026-03-01T08:00:00Z"),
        });
        await seedEntry({
            action: AUDIT_ACTIONS.EXPORT_DATA,
            entity: "Report",
            entityId: "report-42",
            createdAt: new Date("2026-03-15T08:00:00Z"),
        });
        await seedEntry({
            action: AUDIT_ACTIONS.CHANGE_ROLE,
            entity: "Membership",
            entityId: "membership-7",
            createdAt: new Date("2026-04-01T08:00:00Z"),
        });
    });

    it("filters by action", async () => {
        const page = await inTenant(tenantId, () =>
            service().list({ action: AUDIT_ACTIONS.EXPORT_DATA }),
        );

        expect(page.items).toHaveLength(1);
        expect(page.items[0].entityId).toBe("report-42");
    });

    it("filters by entity and entityId", async () => {
        const byEntity = await inTenant(tenantId, () =>
            service().list({ entity: "Report" }),
        );
        expect(byEntity.items).toHaveLength(1);

        const byId = await inTenant(tenantId, () =>
            service().list({ entityId: "membership-7" }),
        );
        expect(byId.items[0].action).toBe(AUDIT_ACTIONS.CHANGE_ROLE);
    });

    it("filters by an inclusive date range", async () => {
        const page = await inTenant(tenantId, () =>
            service().list({
                from: "2026-03-01T00:00:00.000Z",
                to: "2026-03-31T23:59:59.999Z",
            }),
        );

        expect(page.items).toHaveLength(2);
        expect(page.items.map((i) => i.action)).not.toContain(
            AUDIT_ACTIONS.CHANGE_ROLE,
        );
    });

    it("treats a date-only upper bound as the whole day", async () => {
        // Without widening, entries later on 2026-03-15 would be excluded.
        await seedEntry({
            action: AUDIT_ACTIONS.LOGOUT,
            createdAt: new Date("2026-03-15T23:30:00Z"),
        });

        const page = await inTenant(tenantId, () =>
            service().list({ from: "2026-03-15", to: "2026-03-15" }),
        );

        expect(page.items).toHaveLength(2);
    });

    it("combines filters with AND", async () => {
        const page = await inTenant(tenantId, () =>
            service().list({
                action: AUDIT_ACTIONS.LOGIN,
                entity: "Report",
            }),
        );

        expect(page.items).toHaveLength(0);
    });
});

describe("searching", () => {
    beforeEach(async () => {
        await seedEntry({
            action: AUDIT_ACTIONS.LOGIN,
            entity: "User",
            entityId: actorId,
            ipAddress: "203.0.113.7",
        });
        await seedEntry({
            action: AUDIT_ACTIONS.EXPORT_DATA,
            entity: "Report",
            entityId: "report-abc",
        });
    });

    it("matches the action name", async () => {
        const page = await inTenant(tenantId, () =>
            service().list({ search: "EXPORT" }),
        );

        expect(page.items).toHaveLength(1);
        expect(page.items[0].action).toBe(AUDIT_ACTIONS.EXPORT_DATA);
    });

    it("matches the entity id", async () => {
        const page = await inTenant(tenantId, () =>
            service().list({ search: "report-abc" }),
        );

        expect(page.items).toHaveLength(1);
    });

    it("matches the actor's email", async () => {
        const page = await inTenant(tenantId, () =>
            service().list({ search: "auditor@" }),
        );

        // Both entries belong to the same actor.
        expect(page.items).toHaveLength(2);
    });

    it("matches the recorded IP address", async () => {
        const page = await inTenant(tenantId, () =>
            service().list({ search: "203.0.113" }),
        );

        expect(page.items).toHaveLength(1);
        expect(page.items[0].action).toBe(AUDIT_ACTIONS.LOGIN);
    });

    it("is case-insensitive", async () => {
        const page = await inTenant(tenantId, () =>
            service().list({ search: "report-ABC" }),
        );

        expect(page.items).toHaveLength(1);
    });

    it("still respects the tenant boundary", async () => {
        const page = await inTenant(otherTenantId, () =>
            service().list({ search: "EXPORT" }),
        );

        expect(page.items).toHaveLength(0);
    });

    it("ignores a blank search term", async () => {
        const page = await inTenant(tenantId, () =>
            service().list({ search: "   " }),
        );

        expect(page.items).toHaveLength(2);
    });
});

describe("shape of a returned entry", () => {
    it("exposes request metadata and metadata verbatim", async () => {
        await seedEntry({
            action: AUDIT_ACTIONS.EXPORT_DATA,
            metadata: { type: "members", format: "csv", fileName: "m.csv" },
            ipAddress: "198.51.100.9",
            userAgent: "Mozilla/5.0 (Test)",
        });

        const page = await inTenant(tenantId, () => service().list({}));
        const entry = page.items[0];

        expect(entry.metadata).toEqual({
            type: "members",
            format: "csv",
            fileName: "m.csv",
        });
        expect(entry.ipAddress).toBe("198.51.100.9");
        expect(entry.userAgent).toBe("Mozilla/5.0 (Test)");
    });

    it("returns user: null for an entry whose actor no longer exists", async () => {
        // `AuditLog.userId` is SetNull on user deletion, so this is the shape
        // after an account is removed — the trail must survive it.
        await seedEntry({ userId: null });

        const page = await inTenant(tenantId, () => service().list({}));

        expect(page.items[0].user).toBeNull();
        expect(page.items[0].userId).toBeNull();
    });
});

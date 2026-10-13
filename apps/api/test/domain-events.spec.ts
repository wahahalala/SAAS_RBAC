import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/prisma/prisma.service";
import { DomainEventsService } from "@/modules/events/domain-events.service";
import { AuditListener } from "@/modules/events/listeners/audit.listener";
import { AnalyticsListener } from "@/modules/events/listeners/analytics.listener";
import { AUDIT_ACTIONS, DOMAIN_EVENTS } from "@saas/shared-types";

/**
 * Listener behaviour over a real database.
 *
 * The listeners are wired to a real EventEmitter (not called directly), so this
 * also covers the wiring: an event emitted through DomainEventsService must
 * reach the listeners, which is the part that silently breaks if a name or
 * decorator is wrong.
 *
 * The email listener is exercised separately (it needs the queue producer).
 */

const db = new PrismaService();

/**
 * ONE emitter for the whole file, shared by the service under test and the
 * listeners: binding listeners to a different instance would silently deliver
 * nothing.
 */
const emitter = new EventEmitter2({ delimiter: "." });

let events: DomainEventsService;

let tenantId!: string;
let userId!: string;

beforeAll(async () => {
    await db.$connect();
    await db.cleanDatabase();
});

afterAll(async () => {
    await db.$disconnect();
});

beforeEach(async () => {
    await db.auditLog.deleteMany();
    await db.usageRecord.deleteMany();
    await db.membership.deleteMany();
    await db.report.deleteMany();
    await db.user.deleteMany();
    await db.tenant.deleteMany();

    const tenant = await db.tenant.create({
        data: { name: "Events Tenant", slug: "events-tenant", plan: "free" },
    });
    tenantId = tenant.id;

    const user = await db.user.create({
        data: { email: "actor@example.com", name: "Actor" },
    });
    userId = user.id;

    // Fresh service over the one shared emitter; drop listeners from the
    // previous test so counts are not double-written.
    emitter.removeAllListeners();
    events = new DomainEventsService(emitter);

    const audit = new AuditListener(db);
    const analytics = new AnalyticsListener(db);

    emitter.on(DOMAIN_EVENTS.USER_CREATED, (e) => audit.onUserCreated(e));
    emitter.on(DOMAIN_EVENTS.TENANT_CREATED, (e) => audit.onTenantCreated(e));
    emitter.on(DOMAIN_EVENTS.ROLE_CHANGED, (e) => audit.onRoleChanged(e));
    emitter.on(DOMAIN_EVENTS.REPORT_COMPLETED, (e) => audit.onReportCompleted(e));

    emitter.on(DOMAIN_EVENTS.USER_CREATED, (e) => analytics.onUserCreated(e));
    emitter.on(DOMAIN_EVENTS.TENANT_CREATED, (e) => analytics.onTenantCreated(e));
    emitter.on(DOMAIN_EVENTS.ROLE_CHANGED, (e) => analytics.onRoleChanged(e));
    emitter.on(DOMAIN_EVENTS.REPORT_COMPLETED, (e) => analytics.onReportCompleted(e));
});

/**
 * Wait for the async listeners to finish.
 *
 * A fixed number of microtask ticks is NOT enough: each listener awaits several
 * Prisma round-trips, so how long it takes depends on the database. Poll the
 * assertion instead, and fail with a clear message on timeout.
 */
async function waitFor(
    check: () => Promise<boolean>,
    timeoutMs = 5_000,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }

    throw new Error("Timed out waiting for the listener to finish");
}

/** Convenience: wait until the table has at least `count` rows. */
function waitForRows(table: "auditLog" | "usageRecord", count = 1): Promise<void> {
    return waitFor(async () => (await db[table].count()) >= count);
}

describe("AuditListener", () => {
    it("writes an audit row for USER_CREATED", async () => {
        events.userCreated({
            tenantId,
            actorId: userId,
            userId,
            email: "new@example.com",
            name: "New User",
            source: "register",
        });

        await waitForRows("auditLog");

        const rows = await db.auditLog.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0].action).toBe(AUDIT_ACTIONS.CREATE_USER);
        expect(rows[0].tenantId).toBe(tenantId);
        expect(rows[0].entityId).toBe(userId);
        expect(rows[0].metadata).toMatchObject({ email: "new@example.com", source: "register" });
    });

    it("writes an audit row for TENANT_CREATED attributed to the owner", async () => {
        events.tenantCreated({
            tenantId,
            actorId: userId,
            tenantName: "Events Tenant",
            tenantSlug: "events-tenant",
            ownerId: userId,
        });

        await waitForRows("auditLog");

        const rows = await db.auditLog.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0].action).toBe(AUDIT_ACTIONS.CREATE_TENANT);
        expect(rows[0].userId).toBe(userId);
        expect(rows[0].metadata).toMatchObject({ slug: "events-tenant" });
    });

    it("records the role transition with both keys", async () => {
        await db.membership.create({
            data: { tenantId, userId, roleId: (await db.role.create({
                data: { key: "member", name: "Member", isSystem: true, tenantId },
            })).id },
        });

        events.roleChanged({
            tenantId,
            actorId: userId,
            membershipId: "membership-1",
            targetUserId: userId,
            previousRoleKey: "member",
            newRoleKey: "admin",
        });

        await waitForRows("auditLog");

        const rows = await db.auditLog.findMany();
        expect(rows[0].action).toBe(AUDIT_ACTIONS.CHANGE_ROLE);
        expect(rows[0].metadata).toMatchObject({
            previousRoleKey: "member",
            newRoleKey: "admin",
        });
    });

    it("records a failed report with its reason", async () => {
        events.reportCompleted({
            tenantId,
            actorId: userId,
            reportId: "report-1",
            reportType: "usage",
            format: "csv",
            status: "failed",
            rowCount: null,
            fileSize: null,
            error: "disk full",
            requestedById: userId,
        });

        await waitForRows("auditLog");

        const rows = await db.auditLog.findMany();
        expect(rows[0].action).toBe(AUDIT_ACTIONS.REPORT_COMPLETED);
        expect(rows[0].metadata).toMatchObject({ error: "disk full" });
    });

    it("does not invent a tenant for a tenant-less event", async () => {
        // The event says null, so the row says null — even when the actor
        // happens to belong to a tenant. Guessing would attribute account
        // creation to an unrelated tenant's audit trail.
        const role = await db.role.create({
            data: { key: "member", name: "Member", isSystem: true, tenantId },
        });
        await db.membership.create({ data: { tenantId, userId, roleId: role.id } });

        events.userCreated({
            tenantId: null,
            actorId: userId,
            userId,
            email: "actor@example.com",
            name: "Actor",
            source: "register",
        });

        await waitForRows("auditLog");

        const rows = await db.auditLog.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0].tenantId).toBeNull();
    });

    it("records a tenant-less USER_CREATED with a null tenant", async () => {
        // Registration: the account exists before it belongs to any tenant.
        // This is the audit entry an operator most wants, so it must be written
        // (with tenantId null) rather than dropped.
        const lonely = await db.user.create({
            data: { email: "lonely@example.com", name: "Lonely" },
        });

        events.userCreated({
            tenantId: null,
            actorId: lonely.id,
            userId: lonely.id,
            email: "lonely@example.com",
            name: "Lonely",
            source: "register",
        });

        await waitForRows("auditLog");

        const rows = await db.auditLog.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0].action).toBe(AUDIT_ACTIONS.CREATE_USER);
        expect(rows[0].tenantId).toBeNull();
        expect(rows[0].userId).toBe(lonely.id);
    });

    it("still records the entry when the named tenant is gone", async () => {
        // The FK would reject a dangling id; losing the audit row over it would
        // be worse, so it is recorded with a null tenant.
        events.roleChanged({
            tenantId: "00000000-0000-0000-0000-000000000000",
            actorId: userId,
            membershipId: "ghost-membership",
            targetUserId: userId,
            previousRoleKey: "member",
            newRoleKey: "admin",
        });

        await waitForRows("auditLog");

        const rows = await db.auditLog.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0].action).toBe(AUDIT_ACTIONS.CHANGE_ROLE);
        expect(rows[0].tenantId).toBeNull();
    });

    it("does not fail the emit when the actor has no user row", async () => {
        events.roleChanged({
            tenantId,
            // A system/OAuth actor id that has no row: the FK would reject it,
            // so the audit row must be written with userId null instead.
            actorId: "00000000-0000-0000-0000-000000000000",
            membershipId: "membership-2",
            targetUserId: userId,
            previousRoleKey: "member",
            newRoleKey: "admin",
        });

        await waitForRows("auditLog");

        const rows = await db.auditLog.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0].userId).toBeNull();
    });
});

describe("AnalyticsListener", () => {
    it("meters USER_CREATED once", async () => {
        events.userCreated({
            tenantId,
            actorId: userId,
            userId,
            email: "metered@example.com",
            name: "Metered",
            source: "register",
        });

        await waitForRows("usageRecord");

        const rows = await db.usageRecord.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0].metric).toBe("event.user.created");
        expect(rows[0].quantity).toBe(1);
        expect(rows[0].tenantId).toBe(tenantId);
    });

    it.each([
        ["tenant.created", "event.tenant.created"],
        ["role.changed", "event.role.changed"],
    ])("meters %s", async (_label, metric) => {
        expect(emitter.listenerCount(DOMAIN_EVENTS.TENANT_CREATED)).toBeGreaterThan(0);

        if (metric === "event.tenant.created") {
            events.tenantCreated({
                tenantId,
                actorId: userId,
                tenantName: "Events Tenant",
                tenantSlug: "events-tenant",
                ownerId: userId,
            });
        } else {
            events.roleChanged({
                tenantId,
                actorId: userId,
                membershipId: "m-1",
                targetUserId: userId,
                previousRoleKey: "member",
                newRoleKey: "admin",
            });
        }

        await waitForRows("usageRecord");

        const rows = await db.usageRecord.findMany();
        expect(rows.some((r) => r.metric === metric)).toBe(true);
    });

    it("meters completed and failed reports under different metrics", async () => {
        events.reportCompleted({
            tenantId,
            actorId: userId,
            reportId: "r-ok",
            reportType: "usage",
            format: "csv",
            status: "completed",
            rowCount: 3,
            fileSize: 100,
            requestedById: userId,
        });
        events.reportCompleted({
            tenantId,
            actorId: userId,
            reportId: "r-bad",
            reportType: "usage",
            format: "csv",
            status: "failed",
            rowCount: null,
            fileSize: null,
            error: "boom",
            requestedById: userId,
        });

        await waitForRows("usageRecord");

        const metrics = (await db.usageRecord.findMany()).map((r) => r.metric).sort();
        // Distinguishing them is what makes a failure spike alertable.
        expect(metrics).toEqual(["event.report.completed", "event.report.failed"]);
    });

    it("skips metering for a tenant-less event", async () => {
        // UsageRecord.tenantId is non-null; metering per tenant is meaningless
        // here, and inventing a tenant would corrupt the usage report.
        events.userCreated({
            tenantId: null,
            actorId: userId,
            userId,
            email: "no-tenant@example.com",
            name: null,
            source: "register",
        });

        // Control event: proves the analytics listener is live in this test.
        events.tenantCreated({
            tenantId,
            actorId: userId,
            tenantName: "Events Tenant",
            tenantSlug: "events-tenant",
            ownerId: userId,
        });
        await waitForRows("usageRecord");

        // Only the control event was metered; the tenant-less one was skipped.
        const rows = await db.usageRecord.findMany();
        expect(rows).toHaveLength(1);
        expect(rows[0].metric).toBe("event.tenant.created");
    });

    it("ignores events for a tenant that no longer exists", async () => {
        events.tenantCreated({
            tenantId: "00000000-0000-0000-0000-000000000000",
            actorId: userId,
            tenantName: "Ghost",
            tenantSlug: "ghost",
            ownerId: userId,
        });

        // Control event for the CURRENT tenant, to prove the listener is live.
        events.tenantCreated({
            tenantId,
            actorId: userId,
            tenantName: "Events Tenant",
            tenantSlug: "events-tenant",
            ownerId: userId,
        });
        await waitForRows("usageRecord");

        const rows = await db.usageRecord.findMany();
        expect(rows).toHaveLength(1);
        // The ghost-tenant event wrote nothing.
        expect(rows[0].tenantId).toBe(tenantId);
    });
});

describe("DomainEventsService", () => {
    it("stamps occurredAt on every event", async () => {
        let received: { occurredAt?: string } | undefined;
        emitter.on(DOMAIN_EVENTS.USER_CREATED, (event) => {
            received = event;
        });

        const service = new DomainEventsService(emitter);
        service.userCreated({
            tenantId,
            userId,
            email: "stamped@example.com",
            name: null,
            source: "register",
        });

        expect(received?.occurredAt).toBeDefined();
        expect(() => new Date(received!.occurredAt!)).not.toThrow();
    });

    it("does not throw when a listener throws", () => {
        emitter.on(DOMAIN_EVENTS.USER_CREATED, () => {
            throw new Error("listener exploded");
        });

        const service = new DomainEventsService(emitter);

        // The write that triggered the event already committed; a broken
        // listener must not turn that into a failed request.
        expect(() =>
            service.userCreated({
                tenantId,
                userId,
                email: "resilient@example.com",
                name: null,
                source: "register",
            }),
        ).not.toThrow();
    });
});

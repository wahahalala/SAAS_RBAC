import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/prisma/prisma.service";
import { DomainEventsService } from "@/modules/events/domain-events.service";
import { AuditListener } from "@/modules/events/listeners/audit.listener";
import { AUDIT_ACTIONS, DOMAIN_EVENTS } from "@saas/shared-types";

/**
 * Every auditable action must actually reach `AuditLog`.
 *
 * The listening layer is exercised through a real EventEmitter, and each case
 * asserts the exact `action` string the query API filters on — a mismatch
 * between what is written and what can be filtered is invisible otherwise.
 */

const db = new PrismaService();
const emitter = new EventEmitter2({ delimiter: "." });

let events: DomainEventsService;
let tenantId!: string;
let userId!: string;

beforeAll(async () => {
    await db.$connect();
});

afterAll(async () => {
    await db.$disconnect();
});

beforeEach(async () => {
    await db.auditLog.deleteMany();
    await db.user.deleteMany();
    await db.tenant.deleteMany();

    const tenant = await db.tenant.create({
        data: { name: "Action Tenant", slug: "action-tenant", plan: "free" },
    });
    tenantId = tenant.id;

    const user = await db.user.create({
        data: { email: "actor@example.com", name: "Actor" },
    });
    userId = user.id;

    emitter.removeAllListeners();
    events = new DomainEventsService(emitter);

    const audit = new AuditListener(db);
    const bind = (name: string, handler: (event: never) => Promise<void>) =>
        emitter.on(name, handler as never);

    bind(DOMAIN_EVENTS.USER_CREATED, (e) => audit.onUserCreated(e));
    bind(DOMAIN_EVENTS.USER_DELETED, (e) => audit.onUserDeleted(e));
    bind(DOMAIN_EVENTS.TENANT_CREATED, (e) => audit.onTenantCreated(e));
    bind(DOMAIN_EVENTS.ROLE_CHANGED, (e) => audit.onRoleChanged(e));
    bind(DOMAIN_EVENTS.REPORT_COMPLETED, (e) => audit.onReportCompleted(e));
    bind(DOMAIN_EVENTS.USER_LOGGED_IN, (e) => audit.onLoggedIn(e));
    bind(DOMAIN_EVENTS.USER_LOGGED_OUT, (e) => audit.onLoggedOut(e));
    bind(DOMAIN_EVENTS.DATA_EXPORTED, (e) => audit.onDataExported(e));
});

async function waitForRows(count = 1, timeoutMs = 5_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if ((await db.auditLog.count()) >= count) return;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    throw new Error("Timed out waiting for the audit row");
}

async function entry(action: string) {
    await waitForRows();
    return db.auditLog.findFirstOrThrow({ where: { action } });
}

describe("the six auditable actions", () => {
    it("records CREATE_USER", async () => {
        events.userCreated({
            tenantId,
            actorId: userId,
            userId,
            email: "actor@example.com",
            name: "Actor",
            source: "register",
        });

        const row = await entry(AUDIT_ACTIONS.CREATE_USER);
        expect(row.action).toBe("CREATE_USER");
        expect(row.entity).toBe("User");
    });

    it("records DELETE_USER with the deleted identity", async () => {
        events.userDeleted({
            tenantId,
            actorId: userId,
            userId,
            email: "gone@example.com",
            name: "Gone",
        });

        const row = await entry(AUDIT_ACTIONS.DELETE_USER);

        expect(row.action).toBe("DELETE_USER");
        // The identity is captured in metadata because the user row is gone.
        expect(row.metadata).toMatchObject({ email: "gone@example.com" });
    });

    it("records CHANGE_ROLE with both role keys", async () => {
        events.roleChanged({
            tenantId,
            actorId: userId,
            membershipId: "membership-1",
            targetUserId: userId,
            previousRoleKey: "member",
            newRoleKey: "admin",
        });

        const row = await entry(AUDIT_ACTIONS.CHANGE_ROLE);

        expect(row.action).toBe("CHANGE_ROLE");
        expect(row.metadata).toMatchObject({
            previousRoleKey: "member",
            newRoleKey: "admin",
        });
    });

    it("records LOGIN with the method and device", async () => {
        events.loggedIn({
            tenantId: null,
            actorId: userId,
            userId,
            email: "actor@example.com",
            method: "password",
            device: "Mozilla/5.0 (Test)",
            request: { ipAddress: "203.0.113.5", userAgent: "Mozilla/5.0 (Test)" },
        });

        const row = await entry(AUDIT_ACTIONS.LOGIN);

        expect(row.action).toBe("LOGIN");
        expect(row.metadata).toMatchObject({ method: "password" });
        // A login happens before a tenant is chosen, so the row has none.
        expect(row.tenantId).toBeNull();
        expect(row.ipAddress).toBe("203.0.113.5");
        expect(row.userAgent).toBe("Mozilla/5.0 (Test)");
    });

    it("records LOGOUT, including all-devices sign-out", async () => {
        events.loggedOut({
            tenantId: null,
            actorId: userId,
            userId,
            email: "actor@example.com",
            allDevices: true,
        });

        const row = await entry(AUDIT_ACTIONS.LOGOUT);

        expect(row.action).toBe("LOGOUT");
        expect(row.metadata).toMatchObject({ allDevices: true });
    });

    it("records EXPORT_DATA with the artifact details", async () => {
        events.dataExported({
            tenantId,
            actorId: userId,
            userId,
            reportId: "report-1",
            reportType: "members",
            format: "csv",
            fileName: "members-1.csv",
        });

        const row = await entry(AUDIT_ACTIONS.EXPORT_DATA);

        expect(row.action).toBe("EXPORT_DATA");
        expect(row.entity).toBe("Report");
        expect(row.entityId).toBe("report-1");
        expect(row.metadata).toMatchObject({ format: "csv", fileName: "members-1.csv" });
    });
});

describe("audit rows record the request origin", () => {
    it("stores the IP and User-Agent carried by the event", async () => {
        events.loggedIn({
            tenantId: null,
            actorId: userId,
            userId,
            email: "actor@example.com",
            method: "oauth",
            request: {
                ipAddress: "198.51.100.23",
                userAgent: "curl/8.0",
            },
        });

        const row = await entry(AUDIT_ACTIONS.LOGIN);

        expect(row.ipAddress).toBe("198.51.100.23");
        expect(row.userAgent).toBe("curl/8.0");
    });

    it("leaves them null for worker-produced facts (no HTTP request)", async () => {
        events.reportCompleted({
            tenantId,
            actorId: userId,
            reportId: "report-2",
            reportType: "usage",
            format: "pdf",
            status: "completed",
            rowCount: 3,
            fileSize: 100,
            requestedById: userId,
        });

        const row = await entry(AUDIT_ACTIONS.REPORT_COMPLETED);

        expect(row.ipAddress).toBeNull();
        expect(row.userAgent).toBeNull();
    });
});

describe("actor attribution", () => {
    it("keeps the DELETE_USER row even after the user is really deleted", async () => {
        const doomed = await db.user.create({
            data: { email: "doomed@example.com", name: "Doomed" },
        });

        events.userDeleted({
            tenantId,
            actorId: userId,
            userId: doomed.id,
            email: doomed.email,
            name: doomed.name,
        });
        await waitForRows();

        // Deleting the user must not take the audit row with it.
        await db.user.delete({ where: { id: doomed.id } });

        const row = await db.auditLog.findFirstOrThrow({
            where: { action: AUDIT_ACTIONS.DELETE_USER },
        });

        // The deleted user is identified by entityId + metadata; `userId` is the
        // ACTOR who performed the deletion (here a different user), so it stays.
        expect(row.entityId).toBe(doomed.id);
        expect(row.userId).toBe(userId);
        expect(row.userId).not.toBe(doomed.id);
        expect(row.metadata).toMatchObject({ email: "doomed@example.com" });
    });

    it("attributes EXPORT_DATA to the downloader, not the requester", async () => {
        const other = await db.user.create({
            data: { email: "downloader@example.com", name: "Downloader" },
        });

        events.dataExported({
            tenantId,
            // The actor is whoever actually downloaded it.
            actorId: other.id,
            userId: other.id,
            reportId: "report-3",
            reportType: "usage",
            format: "csv",
            fileName: null,
        });

        const row = await entry(AUDIT_ACTIONS.EXPORT_DATA);

        expect(row.userId).toBe(other.id);
    });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaService } from "@/prisma/prisma.service";
import { TenantContext } from "@/modules/tenant";
import { ReportsService } from "@/modules/reports/reports.service";
import { ReportQueueService } from "@/modules/queue";
import { DomainEventsService } from "@/modules/events";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

/**
 * Report request lifecycle over a real database.
 *
 * The queue producer is stubbed: what is under test here is the API's own
 * behaviour — row creation, status reporting, tenant scoping and download
 * readiness — not BullMQ (covered by the queue contract suite).
 */

const db = new PrismaService();
const tenantContext = new TenantContext();

interface EnqueuedCall {
    reportId: string;
    tenantId: string;
    reportType: string;
    format: string;
}

function createService(options: { failEnqueue?: boolean } = {}) {
    const enqueued: EnqueuedCall[] = [];

    const queueStub = {
        enqueueReport: async (data: EnqueuedCall) => {
            if (options.failEnqueue) {
                throw new Error("Redis unavailable");
            }
            enqueued.push(data);
            return `job-${data.reportId}`;
        },
    } as unknown as ReportQueueService;

    // Domain events are a side effect of generating/downloading; a stub keeps
    // this suite about the reports API itself.
    const eventsStub = {
        dataExported: () => undefined,
    } as unknown as DomainEventsService;

    const service = new ReportsService(db, tenantContext, queueStub, eventsStub);
    return { service, enqueued };
}

let tenantId!: string;
let otherTenantId!: string;
let userId!: string;
let artifactDir!: string;

beforeAll(async () => {
    await db.$connect();
    await db.cleanDatabase();

    const tenant = await db.tenant.create({
        data: { name: "Reports Tenant", slug: "reports-tenant", plan: "free" },
    });
    tenantId = tenant.id;

    const other = await db.tenant.create({
        data: { name: "Other Tenant", slug: "other-reports-tenant", plan: "free" },
    });
    otherTenantId = other.id;

    const user = await db.user.create({
        data: { email: "reporter@example.com", name: "Reporter" },
    });
    userId = user.id;

    artifactDir = await mkdtemp(join(tmpdir(), "reports-spec-"));
});

afterAll(async () => {
    await rm(artifactDir, { recursive: true, force: true });
    await db.$disconnect();
});

beforeEach(async () => {
    await db.report.deleteMany();
});

describe("requesting a report", () => {
    it("creates a pending row and enqueues a job carrying that id", async () => {
        const { service, enqueued } = createService();

        const result = await tenantContext.run({ tenantId }, () =>
            service.create(userId, { type: "usage", format: "csv" }),
        );

        expect(result.status).toBe("pending");
        expect(result.type).toBe("usage");
        expect(result.format).toBe("csv");
        expect(result.jobId).toBe(`job-${result.id}`);

        // The job must reference the row the client will poll.
        expect(enqueued).toHaveLength(1);
        expect(enqueued[0].reportId).toBe(result.id);
        expect(enqueued[0].tenantId).toBe(tenantId);
    });

    it("does not expose the storage path", async () => {
        const { service } = createService();

        const result = await tenantContext.run({ tenantId }, () =>
            service.create(userId, { type: "members", format: "pdf" }),
        );

        expect(JSON.stringify(result)).not.toContain("filePath");
    });

    it.each([
        ["usage", "csv"],
        ["members", "csv"],
        ["billing", "pdf"],
    ])("accepts %s/%s", async (type, format) => {
        const { service } = createService();

        const result = await tenantContext.run({ tenantId }, () =>
            service.create(userId, { type, format }),
        );

        expect(result.type).toBe(type);
        expect(result.format).toBe(format);
    });

    it.each([
        ["nonsense", "csv"],
        ["usage", "exe"],
        ["", "csv"],
        ["usage", ""],
    ])("rejects %s/%s before touching the queue", async (type, format) => {
        const { service, enqueued } = createService();

        await expect(
            tenantContext.run({ tenantId }, () => service.create(userId, { type, format })),
        ).rejects.toThrow(/type must be one of|format must be one of/);

        expect(enqueued).toHaveLength(0);
    });

    it("refuses a second identical report while one is in flight", async () => {
        const { service } = createService();

        await tenantContext.run({ tenantId }, () =>
            service.create(userId, { type: "usage", format: "csv" }),
        );

        await expect(
            tenantContext.run({ tenantId }, () =>
                service.create(userId, { type: "usage", format: "csv" }),
            ),
        ).rejects.toThrow(/already being generated/i);
    });

    it("allows the same type in a different format, and a different type", async () => {
        const { service } = createService();

        await tenantContext.run({ tenantId }, () =>
            service.create(userId, { type: "usage", format: "csv" }),
        );

        // Different format is a different artifact, so it is allowed.
        await expect(
            tenantContext.run({ tenantId }, () =>
                service.create(userId, { type: "usage", format: "pdf" }),
            ),
        ).resolves.toBeTruthy();

        await expect(
            tenantContext.run({ tenantId }, () =>
                service.create(userId, { type: "members", format: "csv" }),
            ),
        ).resolves.toBeTruthy();
    });

    it("allows a new request once the previous one finished", async () => {
        const { service } = createService();

        const first = await tenantContext.run({ tenantId }, () =>
            service.create(userId, { type: "usage", format: "csv" }),
        );

        await db.report.update({
            where: { id: first.id },
            data: { status: "completed" },
        });

        await expect(
            tenantContext.run({ tenantId }, () =>
                service.create(userId, { type: "usage", format: "csv" }),
            ),
        ).resolves.toBeTruthy();
    });

    it("records a failure instead of leaving a pending row when enqueueing fails", async () => {
        const { service } = createService({ failEnqueue: true });

        const result = await tenantContext.run({ tenantId }, () =>
            service.create(userId, { type: "usage", format: "csv" }),
        );

        // The client would otherwise poll forever.
        expect(result.status).toBe("failed");
        expect(result.error).toMatch(/could not queue job/i);
        expect(result.jobId).toBeNull();

        const stored = await db.report.findUniqueOrThrow({ where: { id: result.id } });
        expect(stored.status).toBe("failed");
    });

    it("fails closed without a tenant context", async () => {
        const { service, enqueued } = createService();

        await expect(
            service.create(userId, { type: "usage", format: "csv" }),
        ).rejects.toThrow(/tenant context is required/i);

        expect(enqueued).toHaveLength(0);
    });
});

describe("reading reports", () => {
    async function seedReport(overrides: Record<string, unknown> = {}) {
        return db.report.create({
            data: {
                tenantId,
                type: "usage",
                format: "csv",
                requestedById: userId,
                ...overrides,
            },
        });
    }

    it("lists only the request tenant's reports, newest first", async () => {
        const mine = await seedReport({ type: "usage" });
        await db.report.create({
            data: {
                tenantId: otherTenantId,
                type: "members",
                format: "pdf",
                requestedById: userId,
            },
        });

        const { service } = createService();
        const listed = await tenantContext.run({ tenantId }, () =>
            service.listForTenant(),
        );

        expect(listed).toHaveLength(1);
        expect(listed[0].id).toBe(mine.id);
    });

    it("does not leak filePath in the list", async () => {
        await seedReport({ filePath: "/srv/secret/report.csv", fileName: "report.csv" });

        const { service } = createService();
        const listed = await tenantContext.run({ tenantId }, () =>
            service.listForTenant(),
        );

        expect(JSON.stringify(listed)).not.toContain("/srv/secret");
        expect(listed[0].fileName).toBe("report.csv");
    });

    it("404s a report belonging to another tenant", async () => {
        const foreign = await db.report.create({
            data: {
                tenantId: otherTenantId,
                type: "usage",
                format: "csv",
                requestedById: userId,
            },
        });

        const { service } = createService();

        await expect(
            tenantContext.run({ tenantId }, () => service.findOne(foreign.id)),
        ).rejects.toThrow(/not found/i);
    });
});

describe("downloading a report", () => {
    async function seedCompletedReport() {
        const filePath = join(artifactDir, "usage-report.csv");
        await writeFile(filePath, "Metric,Total\napi.calls,42\r\n", "utf8");

        return db.report.create({
            data: {
                tenantId,
                type: "usage",
                format: "csv",
                status: "completed",
                filePath,
                fileName: "usage-report.csv",
                fileSize: 26,
                rowCount: 1,
                requestedById: userId,
            },
        });
    }

    it("streams the artifact for a completed report", async () => {
        const report = await seedCompletedReport();
        const { service } = createService();

        const { stream, fileName, fileSize } = await tenantContext.run(
            { tenantId },
            () => service.openDownload(report.id),
        );

        expect(fileName).toBe("usage-report.csv");
        expect(fileSize).toBeGreaterThan(0);

        const chunks: Buffer[] = [];
        for await (const chunk of stream) {
            chunks.push(Buffer.from(chunk));
        }
        expect(Buffer.concat(chunks).toString()).toContain("api.calls,42");
    });

    it("refuses a report that is still pending", async () => {
        const report = await db.report.create({
            data: {
                tenantId,
                type: "usage",
                format: "csv",
                requestedById: userId,
            },
        });

        const { service } = createService();

        await expect(
            tenantContext.run({ tenantId }, () => service.openDownload(report.id)),
        ).rejects.toThrow(/not ready to download/i);
    });

    it("reports a missing file rather than streaming nothing", async () => {
        const report = await db.report.create({
            data: {
                tenantId,
                type: "usage",
                format: "csv",
                status: "completed",
                // Row says completed but the artifact is gone.
                filePath: join(artifactDir, "does-not-exist.csv"),
                fileName: "does-not-exist.csv",
                requestedById: userId,
            },
        });

        const { service } = createService();

        await expect(
            tenantContext.run({ tenantId }, () => service.openDownload(report.id)),
        ).rejects.toThrow(/no longer available/i);
    });

    it("refuses to download another tenant's report", async () => {
        const foreign = await db.report.create({
            data: {
                tenantId: otherTenantId,
                type: "usage",
                format: "csv",
                status: "completed",
                filePath: join(artifactDir, "foreign.csv"),
                fileName: "foreign.csv",
                requestedById: userId,
            },
        });

        const { service } = createService();

        await expect(
            tenantContext.run({ tenantId }, () => service.openDownload(foreign.id)),
        ).rejects.toThrow(/not found/i);
    });
});

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtemp, rm, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PrismaService } from "@/prisma";
import { ReportDataService } from "@/reports/report-data.service";
import { ReportStorageService } from "@/reports/report-storage.service";
import { ReportRunnerService } from "@/reports/report-runner.service";
import type { GenerateReportJob } from "@saas/shared-types";

/**
 * ReportRunnerService over a real database and a real temp filesystem.
 *
 * This is the part that must not silently half-succeed: a report that is marked
 * completed without a file, or left pending after a crash, is worse than one
 * that visibly failed.
 */

const db = new PrismaService();

let artifactDir!: string;
let tenantId!: string;
let otherTenantId!: string;
let runner: ReportRunnerService;

/**
 * Truncate the tables these tests touch.
 *
 * The API's PrismaService has a cleanDatabase() helper; the worker's does not
 * (the worker never wipes data in production), so the test clears explicitly
 * and in dependency order.
 */
async function cleanDatabase() {
    await db.report.deleteMany();
    await db.usageRecord.deleteMany();
    await db.membership.deleteMany();
    await db.subscription.deleteMany();
    await db.invitation.deleteMany();
    await db.role.deleteMany();
    await db.user.deleteMany();
    await db.tenant.deleteMany();
}

beforeAll(async () => {
    await db.$connect();
    await cleanDatabase();
    artifactDir = await mkdtemp(join(tmpdir(), "runner-spec-"));
    // ReportStorageService reads REPORTS_DIR at construction time.
    process.env.REPORTS_DIR = artifactDir;
});

afterAll(async () => {
    delete process.env.REPORTS_DIR;
    await rm(artifactDir, { recursive: true, force: true });
    await db.$disconnect();
});

beforeEach(async () => {
    await cleanDatabase();

    const tenant = await db.tenant.create({
        data: { name: "Runner Tenant", slug: "runner-tenant", plan: "free" },
    });
    tenantId = tenant.id;

    const other = await db.tenant.create({
        data: { name: "Other Runner", slug: "other-runner", plan: "free" },
    });
    otherTenantId = other.id;

    runner = new ReportRunnerService(
        db,
        new ReportDataService(db),
        new ReportStorageService(),
    );
});

async function createPendingReport(
    overrides: Partial<{ tenantId: string; type: string; format: string }> = {},
) {
    const user = await db.user.upsert({
        where: { email: "runner@example.com" },
        update: {},
        create: { email: "runner@example.com", name: "Runner" },
    });

    return db.report.create({
        data: {
            tenantId: overrides.tenantId ?? tenantId,
            type: (overrides.type ?? "usage") as "usage" | "members" | "billing",
            format: (overrides.format ?? "csv") as "csv" | "pdf",
            requestedById: user.id,
        },
    });
}

function jobFor(report: { id: string; tenantId: string; type: string; format: string }): GenerateReportJob {
    return {
        type: "generate-report",
        reportId: report.id,
        tenantId: report.tenantId,
        reportType: report.type as GenerateReportJob["reportType"],
        format: report.format as GenerateReportJob["format"],
        requestedBy: "runner-user",
    };
}

describe("successful generation", () => {
    it("writes a CSV artifact and marks the report completed", async () => {
        await db.usageRecord.createMany({
            data: [
                { tenantId, metric: "api.calls", quantity: 100 },
                { tenantId, metric: "api.calls", quantity: 250 },
            ],
        });
        const report = await createPendingReport({ type: "usage", format: "csv" });

        await runner.run(jobFor(report));

        const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect(stored.status).toBe("completed");
        expect(stored.error).toBeNull();
        expect(stored.filePath).toBeTruthy();
        expect(stored.rowCount).toBe(1); // api.calls aggregated into one row
        expect(stored.completedAt).toBeInstanceOf(Date);

        const content = await readFile(stored.filePath!, "utf8");
        expect(content).toContain("Metric,Total Quantity,Records");
        expect(content).toContain("api.calls,350,2");

        // The recorded size must match what is actually on disk.
        expect(stored.fileSize).toBe((await stat(stored.filePath!)).size);
    });

    it("writes a real PDF artifact", async () => {
        const report = await createPendingReport({ type: "members", format: "pdf" });

        await runner.run(jobFor(report));

        const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect(stored.status).toBe("completed");

        const bytes = await readFile(stored.filePath!);
        expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
        expect(bytes.subarray(-8).toString()).toContain("%%EOF");
    });

    it("writes into a per-tenant directory", async () => {
        const report = await createPendingReport();
        await runner.run(jobFor(report));

        const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect(stored.filePath).toContain(tenantId);
    });

    it("includes the report id in the file name so runs cannot overwrite each other", async () => {
        const first = await createPendingReport({ type: "usage" });
        const second = await createPendingReport({ type: "usage" });

        await runner.run(jobFor(first));
        await runner.run(jobFor(second));

        const a = await db.report.findUniqueOrThrow({ where: { id: first.id } });
        const b = await db.report.findUniqueOrThrow({ where: { id: second.id } });

        expect(a.fileName).not.toBe(b.fileName);
        expect(a.fileName).toContain(first.id);
        expect(b.fileName).toContain(second.id);
    });

    it("succeeds with zero rows and still records the artifact", async () => {
        const report = await createPendingReport({ type: "billing", format: "csv" });

        await runner.run(jobFor(report));

        const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect(stored.status).toBe("completed");
        expect(stored.rowCount).toBe(0);
        // A header-only CSV is still a valid, downloadable file.
        expect(await readFile(stored.filePath!, "utf8")).toContain("Plan,Status");
    });
});

describe("tenant scoping of the generated data", () => {
    it("only includes the requested tenant's rows", async () => {
        await db.usageRecord.createMany({
            data: [
                { tenantId, metric: "mine", quantity: 10 },
                { tenantId: otherTenantId, metric: "foreign", quantity: 99 },
            ],
        });

        const report = await createPendingReport({ type: "usage" });
        await runner.run(jobFor(report));

        const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        const content = await readFile(stored.filePath!, "utf8");

        expect(content).toContain("mine");
        expect(content).not.toContain("foreign");
    });

    it("does not leak a member from another tenant", async () => {
        const mine = await db.user.create({
            data: { email: "mine@example.com", name: "Mine" },
        });
        const foreign = await db.user.create({
            data: { email: "foreign@example.com", name: "Foreign" },
        });
        const role = await db.role.create({
            data: { key: "member", name: "Member", isSystem: true, tenantId },
        });

        await db.membership.create({
            data: { tenantId, userId: mine.id, roleId: role.id },
        });
        await db.membership.create({
            data: { tenantId: otherTenantId, userId: foreign.id, roleId: role.id },
        });

        const report = await createPendingReport({ type: "members" });
        await runner.run(jobFor(report));

        const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        const content = await readFile(stored.filePath!, "utf8");

        expect(content).toContain("mine@example.com");
        expect(content).not.toContain("foreign@example.com");
    });
});

describe("failure handling", () => {
    it("marks the report failed, records the reason and rethrows", async () => {
        const report = await createPendingReport();

        // A tenant that does not exist: the job's tenantId is stale.
        const badJob = { ...jobFor(report), tenantId: "00000000-0000-0000-0000-000000000000" };

        await expect(runner.run(badJob)).rejects.toThrow(/no longer exists/i);

        const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect(stored.status).toBe("failed");
        expect(stored.error).toMatch(/no longer exists/i);
        expect(stored.filePath).toBeNull();
        expect(stored.completedAt).toBeInstanceOf(Date);
    });

    it("rethrows so the queue retry policy still applies", async () => {
        const report = await createPendingReport();
        const badJob = { ...jobFor(report), tenantId: "00000000-0000-0000-0000-000000000000" };

        // A swallowed error would mark the job successful in BullMQ.
        await expect(runner.run(badJob)).rejects.toThrow();
    });

    it("clears a previous failure when a retry succeeds", async () => {
        const report = await createPendingReport({ type: "usage" });

        await expect(
            runner.run({ ...jobFor(report), tenantId: "00000000-0000-0000-0000-000000000000" }),
        ).rejects.toThrow();

        const failed = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect(failed.status).toBe("failed");
        expect(failed.error).toBeTruthy();

        // Retry against the correct tenant (the API/queue would re-deliver).
        await runner.run(jobFor(report));

        const recovered = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect(recovered.status).toBe("completed");
        expect(recovered.error).toBeNull();
    });
});

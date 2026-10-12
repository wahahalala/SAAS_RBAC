import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { PrismaService } from "@/prisma";
import { ReportDataService } from "@/reports/report-data.service";
import { ReportStorageService } from "@/reports/report-storage.service";
import { ReportRunnerService } from "@/reports/report-runner.service";
import { DOMAIN_EVENTS } from "@saas/shared-types";

/**
 * REPORT_COMPLETED is produced here, in the worker.
 *
 * The fact must be published to the cross-process bridge AND it must still be
 * published when the report fails — a failure is exactly the fact worth
 * alerting on, and it would be easy to lose it inside the catch block.
 */

const db = new PrismaService();

let artifactDir!: string;
let tenantId!: string;
let userId!: string;
let published: Array<{ name: string; payload: Record<string, unknown> }>;

async function clean() {
    await db.report.deleteMany();
    await db.usageRecord.deleteMany();
    await db.membership.deleteMany();
    await db.subscription.deleteMany();
    await db.role.deleteMany();
    await db.user.deleteMany();
    await db.tenant.deleteMany();
}

beforeAll(async () => {
    await db.$connect();
    artifactDir = await mkdtemp(join(tmpdir(), "events-spec-"));
    process.env.REPORTS_DIR = artifactDir;
});

afterAll(async () => {
    delete process.env.REPORTS_DIR;
    await rm(artifactDir, { recursive: true, force: true });
    await db.$disconnect();
});

beforeEach(async () => {
    await clean();
    published = [];

    const tenant = await db.tenant.create({
        data: { name: "Publish Tenant", slug: "publish-tenant", plan: "free" },
    });
    tenantId = tenant.id;

    const user = await db.user.create({
        data: { email: "publisher@example.com", name: "Publisher" },
    });
    userId = user.id;
});

function buildRunner(publisher: unknown): ReportRunnerService {
    return new ReportRunnerService(
        db,
        new ReportDataService(db),
        new ReportStorageService(),
        publisher as never,
    );
}

function publisherStub() {
    return {
        publish: async (name: string, payload: Record<string, unknown>) => {
            published.push({ name, payload });
        },
    };
}

async function pendingReport() {
    return db.report.create({
        data: {
            tenantId,
            type: "usage",
            format: "csv",
            requestedById: userId,
        },
    });
}

describe("REPORT_COMPLETED publishing", () => {
    it("publishes the fact after the report is marked completed", async () => {
        const report = await pendingReport();
        const runner = buildRunner(publisherStub());

        await runner.run({
            type: "generate-report",
            reportId: report.id,
            tenantId,
            reportType: "usage",
            format: "csv",
            requestedBy: userId,
        });

        expect(published).toHaveLength(1);
        expect(published[0].name).toBe(DOMAIN_EVENTS.REPORT_COMPLETED);
        expect(published[0].payload).toMatchObject({
            tenantId,
            reportId: report.id,
            reportType: "usage",
            format: "csv",
            status: "completed",
            requestedById: userId,
        });

        // The published fact must describe a report that really finished; a
        // listener reading the row at this point sees completed.
        const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect(stored.status).toBe("completed");
        expect(published[0].payload.rowCount).toBe(stored.rowCount);
        expect(published[0].payload.fileSize).toBe(stored.fileSize);
    });

    it("publishes a failure and still fails the job", async () => {
        const report = await pendingReport();
        const runner = buildRunner(publisherStub());

        // A tenant that does not exist makes the run throw.
        await expect(
            runner.run({
                type: "generate-report",
                reportId: report.id,
                tenantId: "00000000-0000-0000-0000-000000000000",
                reportType: "usage",
                format: "csv",
                requestedBy: userId,
            }),
        ).rejects.toThrow(/no longer exists/i);

        // Publishing must not swallow the failure: BullMQ has to retry.
        expect(published).toHaveLength(1);
        expect(published[0].payload).toMatchObject({
            reportId: report.id,
            status: "failed",
        });
        expect(String(published[0].payload.error)).toMatch(/no longer exists/i);
    });

    it("keeps a generated report completed when publishing fails", async () => {
        const report = await pendingReport();
        const runner = buildRunner({
            publish: async () => {
                throw new Error("redis down");
            },
        });

        // The artifact is already written and recorded. A notification failure
        // must not rewrite that success as a failure, nor fail the job (which
        // would regenerate a file that already exists).
        await expect(
            runner.run({
                type: "generate-report",
                reportId: report.id,
                tenantId,
                reportType: "usage",
                format: "csv",
                requestedBy: userId,
            }),
        ).resolves.toBeUndefined();

        const stored = await db.report.findUniqueOrThrow({ where: { id: report.id } });
        expect(stored.status).toBe("completed");
        expect(stored.filePath).toBeTruthy();
        expect(stored.error).toBeNull();
    });
});

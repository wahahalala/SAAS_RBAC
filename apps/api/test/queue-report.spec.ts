import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Queue, Worker, Job } from "bullmq";
import { REPORT_QUEUE, JOBS, DEFAULT_JOB_OPTIONS } from "@/modules/queue";
import type { GenerateReportJob } from "@saas/shared-types";

/**
 * API -> BullMQ -> worker contract for report generation.
 *
 * The API enqueues and apps/worker consumes; both take the queue/job names from
 * `@saas/shared-types`. A rename on one side would leave reports queued forever
 * with no error anywhere, so the coupling is asserted here.
 *
 * A local Worker stands in for apps/worker's ReportProcessor. Skipped when Redis
 * is not running (the API suite covers the request/read logic without it).
 */

const CONNECTION = {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null as null,
};

let queue: Queue;
let worker: Worker | undefined;
let redisAvailable = false;

const processed: GenerateReportJob[] = [];

beforeAll(async () => {
    queue = new Queue(REPORT_QUEUE, { connection: CONNECTION });

    try {
        await queue.waitUntilReady();
        await queue.getJobCounts("waiting");
        redisAvailable = true;
    } catch {
        redisAvailable = false;
        return;
    }

    worker = new Worker(
        REPORT_QUEUE,
        async (job: Job) => {
            if (job.name === JOBS.GENERATE_REPORT) {
                processed.push(job.data as GenerateReportJob);
            }
        },
        { connection: CONNECTION },
    );
    await worker.waitUntilReady();
});

afterAll(async () => {
    if (!redisAvailable) return;
    await worker?.close();
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
});

async function waitFor(check: () => boolean, timeoutMs = 10_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (check()) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out waiting for the job to be processed");
}

const baseJob = (reportId: string): GenerateReportJob => ({
    type: "generate-report",
    reportId,
    tenantId: "tenant-contract",
    reportType: "usage",
    format: "csv",
    requestedBy: "user-contract",
});

describe("API -> BullMQ -> worker report contract", () => {
    it("round-trips a report payload to a worker using the shared names", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        const payload = baseJob("report-roundtrip");
        await queue.add(JOBS.GENERATE_REPORT, payload, {
            ...DEFAULT_JOB_OPTIONS,
            jobId: `report-${payload.reportId}`,
        });

        await waitFor(() => processed.some((j) => j.reportId === payload.reportId));

        const received = processed.find((j) => j.reportId === payload.reportId);
        expect(received).toBeDefined();
        // reportId is what the worker uses to advance the row the client polls.
        expect(received!.reportId).toBe("report-roundtrip");
        expect(received!.tenantId).toBe("tenant-contract");
        expect(received!.reportType).toBe("usage");
        expect(received!.format).toBe("csv");
    });

    it("keeps the shared retry policy and retains failures for inspection", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        const job = await queue.add(JOBS.GENERATE_REPORT, baseJob("report-policy"), {
            ...DEFAULT_JOB_OPTIONS,
            jobId: "report-report-policy",
        });

        expect(job.opts.attempts).toBe(DEFAULT_JOB_OPTIONS.attempts);
        expect(job.opts.removeOnFail).toBe(false);
    });

    it("uses the report id as the job id so a report is enqueued once", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        const data = baseJob("report-dedupe");
        const first = await queue.add(JOBS.GENERATE_REPORT, data, {
            ...DEFAULT_JOB_OPTIONS,
            jobId: `report-${data.reportId}`,
        });
        const second = await queue.add(JOBS.GENERATE_REPORT, data, {
            ...DEFAULT_JOB_OPTIONS,
            jobId: `report-${data.reportId}`,
        });

        expect(String(second.id)).toBe(String(first.id));
    });

    it("rejects a report job id containing a colon", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        // Regression guard: BullMQ refuses custom ids with ":", which silently
        // breaks the enqueue (the caller records a failure instead).
        await expect(
            queue.add(JOBS.GENERATE_REPORT, baseJob("report-colon"), {
                ...DEFAULT_JOB_OPTIONS,
                jobId: "report:colon",
            }),
        ).rejects.toThrow(/Custom Id/i);
    });

    it("distinguishes the queue name from the other queues", () => {
        // A copy/paste slip between EMAIL and REPORT would route reports into
        // the email queue, where nothing would ever pick them up.
        expect(REPORT_QUEUE).toBe("reportQueue");
        expect(REPORT_QUEUE).not.toBe(JOBS.GENERATE_REPORT);
    });
});

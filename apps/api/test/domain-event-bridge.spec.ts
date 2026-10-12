import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Queue, Worker, Job } from "bullmq";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { DOMAIN_EVENT_QUEUE, JOBS, DEFAULT_JOB_OPTIONS } from "@/modules/queue";
import { DOMAIN_EVENTS } from "@saas/shared-types";
import type { PublishDomainEventJob } from "@saas/shared-types";

/**
 * The cross-process bridge.
 *
 * REPORT_COMPLETED is produced by the WORKER, but the listeners live in the API
 * process (Nest's EventEmitter is in-process only). The worker therefore
 * publishes the fact to `domainEventQueue`, and the API's
 * DomainEventBridgeConsumer re-emits it locally.
 *
 * This suite covers the wire between those two processes: the producer's job
 * shape must match what the consumer expects, and the consumer must hand the
 * payload to the local bus unchanged. A mismatch here means listeners silently
 * never fire for worker-produced facts.
 *
 * The consumer used here mirrors the real one (same queue, same job name); the
 * API-side re-emit is exercised by re-emitting onto a real EventEmitter.
 */

const CONNECTION = {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null as null,
};

let queue: Queue;
let worker: Worker | undefined;
let redisAvailable = false;

const emitter = new EventEmitter2({ delimiter: "." });
const received: Array<Record<string, unknown>> = [];

beforeAll(async () => {
    queue = new Queue(DOMAIN_EVENT_QUEUE, { connection: CONNECTION });

    try {
        await queue.waitUntilReady();
        await queue.getJobCounts("waiting");
        redisAvailable = true;
    } catch {
        redisAvailable = false;
        return;
    }

    emitter.on(DOMAIN_EVENTS.REPORT_COMPLETED, (payload) => {
        received.push(payload);
    });

    // Stands in for DomainEventBridgeConsumer: consume by the shared job name
    // and re-emit locally.
    worker = new Worker(
        DOMAIN_EVENT_QUEUE,
        async (job: Job) => {
            if (job.name !== JOBS.PUBLISH_DOMAIN_EVENT) return;
            const data = job.data as PublishDomainEventJob;
            emitter.emit(data.name, data.payload);
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
    throw new Error("Timed out waiting for the bridged event");
}

describe("worker -> API domain-event bridge", () => {
    it("delivers a REPORT_COMPLETED published by the worker to a local listener", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        const payload = {
            tenantId: "tenant-bridge",
            actorId: "user-1",
            reportId: "report-bridge-1",
            reportType: "usage",
            format: "csv",
            status: "completed",
            rowCount: 7,
            fileSize: 2048,
            requestedById: "user-1",
        };

        // Exactly what DomainEventPublisher publishes.
        await queue.add(
            JOBS.PUBLISH_DOMAIN_EVENT,
            {
                type: "publish-domain-event",
                name: DOMAIN_EVENTS.REPORT_COMPLETED,
                payload,
            } satisfies PublishDomainEventJob,
            {
                ...DEFAULT_JOB_OPTIONS,
                jobId: `event-${DOMAIN_EVENTS.REPORT_COMPLETED}-${payload.reportId}`,
            },
        );

        await waitFor(() =>
            received.some((event) => event.reportId === payload.reportId),
        );

        const delivered = received.find(
            (event) => event.reportId === payload.reportId,
        )!;

        // The payload must arrive intact: a dropped field means an audit row or
        // usage metric with wrong data.
        expect(delivered.tenantId).toBe("tenant-bridge");
        expect(delivered.status).toBe("completed");
        expect(delivered.rowCount).toBe(7);
        expect(delivered.requestedById).toBe("user-1");
    });

    it("carries a failed report through the same bridge", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        const payload = {
            tenantId: "tenant-bridge",
            actorId: "user-1",
            reportId: "report-bridge-failed",
            reportType: "users",
            format: "pdf",
            status: "failed",
            rowCount: null,
            fileSize: null,
            error: "disk full",
            requestedById: "user-1",
        };

        await queue.add(
            JOBS.PUBLISH_DOMAIN_EVENT,
            {
                type: "publish-domain-event",
                name: DOMAIN_EVENTS.REPORT_COMPLETED,
                payload,
            } satisfies PublishDomainEventJob,
            {
                ...DEFAULT_JOB_OPTIONS,
                jobId: `event-${DOMAIN_EVENTS.REPORT_COMPLETED}-${payload.reportId}`,
            },
        );

        await waitFor(() =>
            received.some((event) => event.reportId === payload.reportId),
        );

        const delivered = received.find(
            (event) => event.reportId === payload.reportId,
        )!;
        expect(delivered.status).toBe("failed");
        expect(delivered.error).toBe("disk full");
    });

    it("uses a job id without a colon (BullMQ rejects those)", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        // The producer builds ids with "-". A colon is rejected by BullMQ —
        // EXCEPT for its backwards-compatibility carve-out where a two-colon id
        // (three segments) is still accepted, which is a legacy repeatable-job
        // shape, not something to rely on:
        //   job.js: `jobId.includes(':') && jobId.split(':').length !== 3` -> throw
        const payload = {
            type: "publish-domain-event" as const,
            name: DOMAIN_EVENTS.REPORT_COMPLETED,
            payload: { reportId: "colon-test" },
        } satisfies PublishDomainEventJob;

        // One colon (two segments): rejected.
        await expect(
            queue.add(JOBS.PUBLISH_DOMAIN_EVENT, payload, {
                ...DEFAULT_JOB_OPTIONS,
                jobId: "event:colon-test",
            }),
        ).rejects.toThrow(/Custom Id/i);

        // Colon-free (what the producer actually builds): accepted.
        const accepted = await queue.add(JOBS.PUBLISH_DOMAIN_EVENT, payload, {
            ...DEFAULT_JOB_OPTIONS,
            jobId: "event-report.completed-colon-test",
        });
        expect(accepted.id).toBe("event-report.completed-colon-test");
    });

    it("keeps the bridge queue distinct from the report queue", () => {
        // Publishing a fact into the report queue would be picked up by the
        // report processor and fail as an unknown job name.
        expect(DOMAIN_EVENT_QUEUE).toBe("domainEventQueue");
        expect(DOMAIN_EVENT_QUEUE).not.toBe("reportQueue");
    });
});

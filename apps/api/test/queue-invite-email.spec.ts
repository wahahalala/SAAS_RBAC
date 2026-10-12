import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Queue, Worker, Job } from "bullmq";
import { EMAIL_QUEUE, JOBS, DEFAULT_JOB_OPTIONS } from "@/modules/queue";
import type { InviteEmailJob } from "@saas/shared-types";

/**
 * End-to-end check of the API -> BullMQ -> worker hop.
 *
 * The API only ENQUEUES; the processor lives in apps/worker. Both sides import
 * their queue/job names from `@saas/shared-types`, so this suite verifies the
 * contract that makes them interoperable:
 *
 *   - the queue name is the shared one,
 *   - the job name the API enqueues is the name the worker switches on,
 *   - an enqueued invite payload round-trips through Redis intact,
 *   - the retry policy is the shared one (a renamed job/policy on either side
 *     would silently break delivery).
 *
 * A local Worker stands in for apps/worker's EmailProcessor: it consumes with
 * the same queue + job names, which is exactly the coupling under test. If
 * Redis is not running the suite is skipped rather than failing, since these are
 * infrastructure tests (the API unit/integration suites cover the logic).
 */

const REDIS = { host: process.env.REDIS_HOST ?? "localhost", port: Number(process.env.REDIS_PORT ?? 6379) };

const CONNECTION = { ...REDIS, maxRetriesPerRequest: null as null };

let queue: Queue;
let worker: Worker | undefined;
let redisAvailable = false;

const processed: InviteEmailJob[] = [];

beforeAll(async () => {
    queue = new Queue(EMAIL_QUEUE, { connection: CONNECTION });

    try {
        await queue.waitUntilReady();
        // Probe with a real round-trip: an unreachable Redis must skip, not fail.
        await queue.getJobCounts("waiting");
        redisAvailable = true;
    } catch {
        redisAvailable = false;
        return;
    }

    // Mirror the worker's processor: consume by the SHARED job name.
    worker = new Worker(
        EMAIL_QUEUE,
        async (job: Job) => {
            if (job.name === JOBS.INVITE_EMAIL) {
                processed.push(job.data as InviteEmailJob);
            }
        },
        { connection: CONNECTION },
    );
    await worker.waitUntilReady();
});

afterAll(async () => {
    if (!redisAvailable) return;
    await worker?.close();
    // Leave no residue in the shared Redis instance.
    await queue.obliterate({ force: true }).catch(() => undefined);
    await queue.close();
});

async function waitFor(check: () => boolean, timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (check()) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out waiting for the job to be processed");
}

describe("API -> BullMQ -> worker invite email contract", () => {
    it("round-trips an invitation payload to a worker using the shared names", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        const payload: InviteEmailJob = {
            type: "invite-email",
            to: "invitee@example.com",
            inviterName: "Inviter",
            organizationName: "Acme Inc",
            inviteToken: "tok-e2e-roundtrip",
            inviteUrl: "http://localhost:3000/invitations/tok-e2e-roundtrip",
        };

        // Enqueued exactly the way EmailQueueService does it.
        await queue.add(JOBS.INVITE_EMAIL, payload, {
            ...DEFAULT_JOB_OPTIONS,
            jobId: `invite-${payload.inviteToken}`,
        });

        await waitFor(() => processed.some((j) => j.inviteToken === payload.inviteToken));

        const received = processed.find((j) => j.inviteToken === payload.inviteToken);
        expect(received).toBeDefined();
        expect(received!.to).toBe(payload.to);
        expect(received!.inviteUrl).toBe(payload.inviteUrl);
        expect(received!.organizationName).toBe(payload.organizationName);
    });

    it("keeps the shared retry policy on the job", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        const job = await queue.add(
            JOBS.INVITE_EMAIL,
            {
                type: "invite-email",
                to: "policy@example.com",
                inviterName: "Inviter",
                organizationName: "Acme Inc",
                inviteToken: "tok-e2e-policy",
                inviteUrl: "http://localhost:3000/invitations/tok-e2e-policy",
            } satisfies InviteEmailJob,
            { ...DEFAULT_JOB_OPTIONS, jobId: "invite-tok-e2e-policy" },
        );

        expect(job.opts.attempts).toBe(DEFAULT_JOB_OPTIONS.attempts);
        // A failed job must stay inspectable (worker's JobStatusService).
        expect(job.opts.removeOnFail).toBe(false);
    });

    it("rejects a job id containing a colon (the constraint that broke invites)", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        // Regression guard: BullMQ refuses custom ids with ":", and a colon here
        // silently made EVERY invitation email fail to enqueue (the caller
        // logs instead of throwing). Ids must use "-".
        await expect(
            queue.add(
                JOBS.INVITE_EMAIL,
                {
                    type: "invite-email",
                    to: "colon@example.com",
                    inviterName: "Inviter",
                    organizationName: "Acme Inc",
                    inviteToken: "tok-colon",
                    inviteUrl: "http://localhost:3000/invitations/tok-colon",
                } satisfies InviteEmailJob,
                { ...DEFAULT_JOB_OPTIONS, jobId: "invite:tok-colon" },
            ),
        ).rejects.toThrow(/Custom Id/i);
    });

    it("does not enqueue twice for the same invitation token", async (ctx) => {
        if (!redisAvailable) return ctx.skip();

        const token = "tok-e2e-idempotent";
        const data = {
            type: "invite-email",
            to: "idempotent@example.com",
            inviterName: "Inviter",
            organizationName: "Acme Inc",
            inviteToken: token,
            inviteUrl: `http://localhost:3000/invitations/${token}`,
        } satisfies InviteEmailJob;

        const first = await queue.add(JOBS.INVITE_EMAIL, data, {
            ...DEFAULT_JOB_OPTIONS,
            jobId: `invite-${token}`,
        });
        const second = await queue.add(JOBS.INVITE_EMAIL, data, {
            ...DEFAULT_JOB_OPTIONS,
            jobId: `invite-${token}`,
        });

        // Same jobId => BullMQ deduplicates, so a retried invite cannot double-send.
        expect(String(second.id)).toBe(String(first.id));
    });
});

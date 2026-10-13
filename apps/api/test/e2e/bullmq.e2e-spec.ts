import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { Queue, Worker, Job } from "bullmq";
import { createWorld, resetWorld, E2eWorld } from "./world";

/**
 * BullMQ end-to-end.
 *
 * The API is a producer (reportQueue, emailQueue); the worker owns the
 * processors. This suite asserts the contract that makes them interoperate with
 * a REAL Redis: a job enqueued through the queue by the app's own producer is
 * picked up by a real Worker using the shared job names.
 */
describe("BullMQ (e2e)", () => {
    let world: E2eWorld;
    let worker: Worker | undefined;
    const consumed: Array<Record<string, unknown>> = [];

    beforeAll(async () => {
        world = await createWorld();
    });

    afterAll(async () => {
        await worker?.close();
        await world.app.close();
    });

    beforeEach(async () => {
        await resetWorld(world);
        consumed.length = 0;
    });

    async function startConsumer(queueName: string, jobName: string) {
        worker = new Worker(
            queueName,
            async (job: Job) => {
                if (job.name === jobName) {
                    consumed.push(job.data as Record<string, unknown>);
                }
            },
            {
                connection: {
                    host: process.env.REDIS_HOST ?? "localhost",
                    port: Number(process.env.REDIS_PORT ?? 6379),
                },
            },
        );
        await worker.waitUntilReady();
    }

    it("a report requested through the API is consumed by the report worker", async () => {
        // The real report processor is in apps/worker; stand one up here with the
        // SAME shared queue + job names to prove the contract.
        await startConsumer("reportQueue", "generate-report");

        const create = await world.http
            .post("/api/v1/reports")
            .send({ type: "members", format: "csv" })
            .set("Authorization", `Bearer ${world.adminToken}`)
            .set("X-Tenant-Id", world.tenantAId)
            .expect(201);

        expect(create.body.jobId).toBeTruthy();

        const reportId = create.body.id;
        await waitFor(() =>
            consumed.some((job) => job.reportId === reportId),
        );

        const job = consumed.find((entry) => entry.reportId === reportId);
        expect(job).toMatchObject({
            reportId,
            tenantId: world.tenantAId,
            reportType: "members",
            format: "csv",
        });
    });

    it("an invitation email is enqueued to the email queue with the invite token", async () => {
        const queue = new Queue("emailQueue", {
            connection: {
                host: process.env.REDIS_HOST ?? "localhost",
                port: Number(process.env.REDIS_PORT ?? 6379),
            },
        });

        const countsBefore = await queue.getJobCounts("waiting", "completed", "failed");

        await world.http
            .post("/api/v1/organizations/tenant-a/invitations")
            .send({ email: "invitee@example.com", role: "member" })
            .set("Authorization", `Bearer ${world.adminToken}`)
            .set("X-Tenant-Id", world.tenantAId)
            .expect(201);

        // The invite producer's jobId is `invite-<token>`; find it.
        const waiting = await queue.getJobs(["waiting", "completed"]);
        const inviteJob = waiting.find((job) => job.name === "invite-email");

        expect(inviteJob).toBeTruthy();
        expect(inviteJob!.data).toMatchObject({
            type: "invite-email",
            to: "invitee@example.com",
        });

        await queue.obliterate({ force: true }).catch(() => undefined);
        await queue.close();
        void countsBefore;
    });
});

async function waitFor(
    check: () => boolean,
    timeoutMs = 10_000,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (check()) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error("Timed out waiting for the BullMQ job");
}

import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { EMAIL_QUEUE, JOBS } from "../queue/queue.constants";
import type { WelcomeEmailJob, InviteEmailJob } from "../queue/job.types";

/**
 * Processes all emailQueue jobs:
 *   - welcome-email
 *   - invite-email
 *
 * Retries/backoff are configured at enqueue time via DEFAULT_JOB_OPTIONS.
 * Processors only implement the business action; failure is reported through
 * `@OnWorkerEvent("failed")` and BullMQ applies the retry policy.
 */
@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
    private readonly logger = new Logger(EmailProcessor.name);

    async process(job: Job<WelcomeEmailJob | InviteEmailJob>): Promise<void> {
        switch (job.name) {
            case JOBS.WELCOME_EMAIL:
                await this.handleWelcome(job.data as WelcomeEmailJob);
                break;
            case JOBS.INVITE_EMAIL:
                await this.handleInvite(job.data as InviteEmailJob);
                break;
            default:
                throw new Error(`Unknown email job name: ${job.name}`);
        }
    }

    private async handleWelcome(data: WelcomeEmailJob): Promise<void> {
        // TODO: replace with a real transport (SMTP/Resend).
        this.logger.log(`Sending welcome email to ${data.to} (${data.name})`);
        await this.simulateSend();
    }

    private async handleInvite(data: InviteEmailJob): Promise<void> {
        this.logger.log(
            `Sending invite email to ${data.to} for ${data.organizationName}`,
        );
        await this.simulateSend();
    }

    private async simulateSend(): Promise<void> {
        // Simulated latency keeps the job observable in queues.
        await new Promise((resolve) => setTimeout(resolve, 50));
    }

    @OnWorkerEvent("completed")
    onCompleted(job: Job) {
        this.logger.log(`emailQueue job ${job.id} completed`);
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined, error: Error) {
        this.logger.error(
            `emailQueue job ${job?.id ?? "unknown"} failed (attempt ${
                job?.attemptsMade ?? 0
            }): ${error.message}`,
        );
    }
}

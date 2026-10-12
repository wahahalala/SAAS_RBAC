import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { EMAIL_QUEUE, JOBS, DEFAULT_JOB_OPTIONS } from "./queue.constants";
import type { InviteEmailJob } from "./job.types";

/**
 * Producer for the shared `emailQueue`.
 *
 * The API only ENQUEUES; the worker (apps/worker) owns the processors. Queue
 * names and job names come from `@saas/shared-types` so the two sides cannot
 * drift apart.
 */
@Injectable()
export class EmailQueueService {
    private readonly logger = new Logger(EmailQueueService.name);

    constructor(
        @InjectQueue(EMAIL_QUEUE)
        private readonly emailQueue: Queue,
    ) {}

    /**
     * Enqueue the invitation email.
     *
     * `jobId` is derived from the invitation token so a retried/duplicated
     * invite for the same invitation does not send twice (BullMQ ignores a
     * repeated id).
     *
     * NOTE: BullMQ rejects custom job ids containing `:`, so ids use `-` as the
     * separator. A colon here throws at enqueue time ("Custom Id cannot contain :").
     */
    async enqueueInviteEmail(
        data: Omit<InviteEmailJob, "type">,
    ): Promise<string | null> {
        const job = await this.emailQueue.add(
            JOBS.INVITE_EMAIL,
            { type: "invite-email", ...data } satisfies InviteEmailJob,
            {
                ...DEFAULT_JOB_OPTIONS,
                jobId: `invite-${data.inviteToken}`,
            },
        );

        this.logger.log(
            `Enqueued ${JOBS.INVITE_EMAIL} job ${job.id} for ${data.to}`,
        );
        return job.id ? String(job.id) : null;
    }

    async enqueueWelcomeEmail(data: {
        to: string;
        name: string;
    }): Promise<string | null> {
        const job = await this.emailQueue.add(
            JOBS.WELCOME_EMAIL,
            { type: "welcome-email", ...data },
            {
                ...DEFAULT_JOB_OPTIONS,
                jobId: `welcome-${data.to}`,
            },
        );

        return job.id ? String(job.id) : null;
    }
}

import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
    EMAIL_QUEUE,
    JOBS,
    DEFAULT_JOB_OPTIONS,
} from "./queue.constants";
import type { WelcomeEmailJob, InviteEmailJob } from "./job.types";

/**
 * Producer for the emailQueue. Enqueues `welcome-email` and `invite-email`.
 */
@Injectable()
export class EmailService {
    private readonly logger = new Logger(EmailService.name);

    constructor(
        @InjectQueue(EMAIL_QUEUE)
        private readonly emailQueue: Queue,
    ) {}

    async sendWelcomeEmail(data: Omit<WelcomeEmailJob, "type">): Promise<string> {
        const job = await this.emailQueue.add(
            JOBS.WELCOME_EMAIL,
            { type: "welcome-email", ...data },
            {
                ...DEFAULT_JOB_OPTIONS,
                jobId: `welcome-${data.to}`,
            },
        );
        this.logger.log(`Enqueued welcome-email job ${job.id}`);
        return String(job.id);
    }

    async sendInviteEmail(data: Omit<InviteEmailJob, "type">): Promise<string> {
        const job = await this.emailQueue.add(
            JOBS.INVITE_EMAIL,
            { type: "invite-email", ...data },
            {
                ...DEFAULT_JOB_OPTIONS,
                jobId: `invite-${data.inviteToken}`,
            },
        );
        this.logger.log(`Enqueued invite-email job ${job.id}`);
        return String(job.id);
    }
}

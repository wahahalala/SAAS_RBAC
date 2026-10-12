import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
    NOTIFICATION_QUEUE,
    JOBS,
    DEFAULT_JOB_OPTIONS,
} from "./queue.constants";
import type { SendNotificationJob } from "./job.types";

/**
 * Producer for the notificationQueue. Enqueues `send-notification`.
 */
@Injectable()
export class NotificationService {
    private readonly logger = new Logger(NotificationService.name);

    constructor(
        @InjectQueue(NOTIFICATION_QUEUE)
        private readonly notificationQueue: Queue,
    ) {}

    async sendNotification(
        data: Omit<SendNotificationJob, "type">,
    ): Promise<string> {
        const job = await this.notificationQueue.add(
            JOBS.SEND_NOTIFICATION,
            { type: "send-notification", ...data },
            DEFAULT_JOB_OPTIONS,
        );
        this.logger.log(
            `Enqueued send-notification job ${job.id} for user ${data.userId}`,
        );
        return String(job.id);
    }
}

import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { NOTIFICATION_QUEUE, JOBS } from "../queue/queue.constants";
import type { SendNotificationJob } from "../queue/job.types";

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor extends WorkerHost {
    private readonly logger = new Logger(NotificationProcessor.name);

    async process(job: Job<SendNotificationJob>): Promise<void> {
        if (job.name !== JOBS.SEND_NOTIFICATION) {
            throw new Error(`Unknown notification job name: ${job.name}`);
        }

        const { userId, title, channel } = job.data;
        this.logger.log(
            `Sending "${title}" notification to user ${userId} via ${channel}`,
        );

        await new Promise((resolve) => setTimeout(resolve, 30));
    }

    @OnWorkerEvent("completed")
    onCompleted(job: Job) {
        this.logger.log(`notificationQueue job ${job.id} completed`);
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined, error: Error) {
        this.logger.error(
            `notificationQueue job ${job?.id ?? "unknown"} failed: ${
                error.message
            }`,
        );
    }
}

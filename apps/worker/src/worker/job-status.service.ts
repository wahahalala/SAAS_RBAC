import { Injectable } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
    EMAIL_QUEUE,
    REPORT_QUEUE,
    NOTIFICATION_QUEUE,
} from "../queue/queue.constants";

export interface JobStatusInfo {
    id: string;
    name: string;
    state: string;
    attemptsMade: number;
    progress: number | object;
    failedReason?: string;
    data: unknown;
}

/**
 * Query-only helper: job status across all queues (inspect failed jobs too).
 */
@Injectable()
export class JobStatusService {
    constructor(
        @InjectQueue(EMAIL_QUEUE) private readonly emailQueue: Queue,
        @InjectQueue(REPORT_QUEUE) private readonly reportQueue: Queue,
        @InjectQueue(NOTIFICATION_QUEUE)
        private readonly notificationQueue: Queue,
    ) {}

    async getJob(queueName: string, jobId: string): Promise<JobStatusInfo | null> {
        const queue = this.queueByName(queueName);
        if (!queue) return null;

        const job = await queue.getJob(jobId);
        if (!job) return null;
        return this.toStatus(job);
    }

    async getFailed(queueName?: string): Promise<JobStatusInfo[]> {
        const queues = queueName
            ? [this.queueByName(queueName)].filter(Boolean) as Queue[]
            : [this.emailQueue, this.reportQueue, this.notificationQueue];

        const results: JobStatusInfo[] = [];
        for (const queue of queues) {
            const failed = await queue.getFailed();
            results.push(...failed.map((j) => this.toStatus(j)));
        }
        return results;
    }

    async getCounts(queueName: string): Promise<Record<string, number>> {
        const queue = this.queueByName(queueName);
        if (!queue) return {};
        return queue.getJobCounts("waiting", "active", "completed", "failed", "delayed");
    }

    private queueByName(name: string): Queue | undefined {
        switch (name) {
            case EMAIL_QUEUE:
                return this.emailQueue;
            case REPORT_QUEUE:
                return this.reportQueue;
            case NOTIFICATION_QUEUE:
                return this.notificationQueue;
            default:
                return undefined;
        }
    }

    private toStatus(job: any): JobStatusInfo {
        return {
            id: String(job.id),
            name: job.name,
            state: job.failedReason
                ? "failed"
                : job.progress === 100
                  ? "completed"
                  : "in-progress",
            attemptsMade: job.attemptsMade,
            progress: job.progress,
            failedReason: job.failedReason ?? undefined,
            data: job.data,
        };
    }
}

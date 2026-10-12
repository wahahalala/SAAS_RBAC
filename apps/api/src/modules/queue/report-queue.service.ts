import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { REPORT_QUEUE, JOBS, DEFAULT_JOB_OPTIONS } from "./queue.constants";
import type { GenerateReportJob } from "./job.types";

/**
 * Producer for the shared `reportQueue`.
 *
 * The API only ENQUEUES; apps/worker owns the processor that builds the file.
 */
@Injectable()
export class ReportQueueService {
    private readonly logger = new Logger(ReportQueueService.name);

    constructor(
        @InjectQueue(REPORT_QUEUE)
        private readonly reportQueue: Queue,
    ) {}

    /**
     * Enqueue a report generation job.
     *
     * `jobId` is the report id: it makes the enqueue idempotent per report, and
     * lets the worker's job be traced back to the row the client polls.
     *
     * NOTE: BullMQ rejects custom job ids containing `:` — use `-` (a colon
     * throws at enqueue time, which would silently break every enqueue).
     */
    async enqueueReport(
        data: Omit<GenerateReportJob, "type">,
    ): Promise<string | null> {
        const job = await this.reportQueue.add(
            JOBS.GENERATE_REPORT,
            { type: "generate-report", ...data } satisfies GenerateReportJob,
            {
                ...DEFAULT_JOB_OPTIONS,
                jobId: `report-${data.reportId}`,
            },
        );

        this.logger.log(
            `Enqueued ${JOBS.GENERATE_REPORT} job ${job.id} (${data.reportType}/${data.format})`,
        );

        return job.id ? String(job.id) : null;
    }
}

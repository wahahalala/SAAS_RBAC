import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import {
    REPORT_QUEUE,
    JOBS,
    DEFAULT_JOB_OPTIONS,
} from "./queue.constants";
import type { GenerateReportJob } from "./job.types";

/**
 * Producer for the reportQueue. Enqueues `generate-report`.
 */
@Injectable()
export class ReportService {
    private readonly logger = new Logger(ReportService.name);

    constructor(
        @InjectQueue(REPORT_QUEUE)
        private readonly reportQueue: Queue,
    ) {}

    async generateReport(
        data: Omit<GenerateReportJob, "type">,
    ): Promise<string> {
        const job = await this.reportQueue.add(
            JOBS.GENERATE_REPORT,
            { type: "generate-report", ...data },
            {
                ...DEFAULT_JOB_OPTIONS,
                jobId: `report-${data.tenantId}-${data.reportType}`,
            },
        );
        this.logger.log(
            `Enqueued generate-report job ${job.id} (${data.reportType})`,
        );
        return String(job.id);
    }
}

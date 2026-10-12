import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { REPORT_QUEUE, JOBS } from "../queue/queue.constants";
import type { GenerateReportJob } from "../queue/job.types";
import { ReportRunnerService } from "@/reports";

@Processor(REPORT_QUEUE)
export class ReportProcessor extends WorkerHost {
    private readonly logger = new Logger(ReportProcessor.name);

    constructor(private readonly runner: ReportRunnerService) {
        super();
    }

    async process(job: Job<GenerateReportJob>): Promise<void> {
        if (job.name !== JOBS.GENERATE_REPORT) {
            throw new Error(`Unknown report job name: ${job.name}`);
        }

        const { reportId, reportType, format } = job.data;
        this.logger.log(
            `Generating ${reportType} report as ${format} (report ${reportId})`,
        );

        // Report failures are recorded on the Report row and re-thrown so the
        // shared retry policy applies.
        await this.runner.run(job.data);
    }

    @OnWorkerEvent("completed")
    onCompleted(job: Job) {
        this.logger.log(`reportQueue job ${job.id} completed`);
    }

    @OnWorkerEvent("failed")
    onFailed(job: Job | undefined, error: Error) {
        this.logger.error(
            `reportQueue job ${job?.id ?? "unknown"} failed: ${error.message}`,
        );
    }
}

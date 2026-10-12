import { Processor, WorkerHost, OnWorkerEvent } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import { Job } from "bullmq";
import { REPORT_QUEUE, JOBS } from "../queue/queue.constants";
import type { GenerateReportJob } from "../queue/job.types";

@Processor(REPORT_QUEUE)
export class ReportProcessor extends WorkerHost {
    private readonly logger = new Logger(ReportProcessor.name);

    async process(job: Job<GenerateReportJob>): Promise<void> {
        if (job.name !== JOBS.GENERATE_REPORT) {
            throw new Error(`Unknown report job name: ${job.name}`);
        }

        const { tenantId, reportType, requestedBy } = job.data;
        this.logger.log(
            `Generating ${reportType} report for tenant ${tenantId} (requested by ${requestedBy})`,
        );

        // Simulate a long-running report build.
        await new Promise((resolve) => setTimeout(resolve, 200));
        this.logger.log(`Report ${job.id} generated`);
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

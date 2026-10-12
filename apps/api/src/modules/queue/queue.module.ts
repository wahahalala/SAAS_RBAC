import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { EMAIL_QUEUE, REPORT_QUEUE } from "./queue.constants";
import { EmailQueueService } from "./email-queue.service";
import { ReportQueueService } from "./report-queue.service";

/**
 * Producer-side queue module for the API.
 *
 * Registers the shared queues and exposes services that ENQUEUE jobs. The
 * processors live in apps/worker — this app never consumes jobs, so the
 * connection is producer-only.
 *
 * NOTE: BullMQ connections are lazy, so a missing Redis does not break app
 * boot; enqueue calls fail (and the caller decides how to react).
 */
@Module({
    imports: [
        BullModule.registerQueue(
            { name: EMAIL_QUEUE },
            { name: REPORT_QUEUE },
        ),
    ],
    providers: [EmailQueueService, ReportQueueService],
    exports: [EmailQueueService, ReportQueueService],
})
export class QueueModule {}

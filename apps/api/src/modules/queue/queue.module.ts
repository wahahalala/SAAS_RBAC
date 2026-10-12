import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import {
    DOMAIN_EVENT_QUEUE,
    EMAIL_QUEUE,
    REPORT_QUEUE,
} from "./queue.constants";
import { EmailQueueService } from "./email-queue.service";
import { ReportQueueService } from "./report-queue.service";

/**
 * Producer-side queue module for the API.
 *
 * Registers the shared queues and exposes services that ENQUEUE jobs. The
 * processors live in apps/worker — this app never consumes jobs, EXCEPT the
 * domain-event bridge queue, which the worker produces and this app drains
 * (see DomainEventBridgeConsumer).
 *
 * NOTE: BullMQ connections are lazy, so a missing Redis does not break app
 * boot; enqueue calls fail (and the caller decides how to react).
 */
@Module({
    imports: [
        BullModule.registerQueue(
            { name: EMAIL_QUEUE },
            { name: REPORT_QUEUE },
            { name: DOMAIN_EVENT_QUEUE },
        ),
    ],
    providers: [EmailQueueService, ReportQueueService],
    exports: [EmailQueueService, ReportQueueService],
})
export class QueueModule {}

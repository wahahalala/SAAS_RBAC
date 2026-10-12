import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import {
    EMAIL_QUEUE,
    REPORT_QUEUE,
    NOTIFICATION_QUEUE,
} from "./queue.constants";
import { EmailService } from "./email.service";
import { ReportService } from "./report.service";
import { NotificationService } from "./notification.service";

/**
 * QueueModule registers the three BullMQ queues and exposes producer services
 * that ENQUEUE jobs. Processors live in WorkerModule.
 */
@Module({
    imports: [
        BullModule.registerQueue(
            { name: EMAIL_QUEUE },
            { name: REPORT_QUEUE },
            { name: NOTIFICATION_QUEUE },
        ),
    ],
    providers: [EmailService, ReportService, NotificationService],
    exports: [EmailService, ReportService, NotificationService],
})
export class QueueModule {}

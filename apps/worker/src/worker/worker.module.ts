import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import {
    EMAIL_QUEUE,
    REPORT_QUEUE,
    NOTIFICATION_QUEUE,
} from "../queue/queue.constants";
import { EmailProcessor } from "../processors/email.processor";
import { ReportProcessor } from "../processors/report.processor";
import { NotificationProcessor } from "../processors/notification.processor";
import { JobStatusService } from "./job-status.service";

/**
 * WorkerModule wires all queue PROCESSORS together plus the job-status query
 * service. Producers live in QueueModule; app.module imports both.
 */
@Module({
    imports: [
        BullModule.registerQueue(
            { name: EMAIL_QUEUE },
            { name: REPORT_QUEUE },
            { name: NOTIFICATION_QUEUE },
        ),
    ],
    providers: [
        EmailProcessor,
        ReportProcessor,
        NotificationProcessor,
        JobStatusService,
    ],
    exports: [JobStatusService],
})
export class WorkerModule {}

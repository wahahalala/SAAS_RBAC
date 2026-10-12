import { Module } from "@nestjs/common";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";
import { QueueModule } from "@/modules/queue";

@Module({
    // QueueModule provides the producer used to enqueue report jobs.
    imports: [QueueModule],
    controllers: [ReportsController],
    providers: [ReportsService],
    exports: [ReportsService],
})
export class ReportsModule {}

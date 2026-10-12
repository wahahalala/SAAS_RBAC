import { Module } from "@nestjs/common";
import { ReportDataService } from "./report-data.service";
import { ReportStorageService } from "./report-storage.service";
import { ReportRunnerService } from "./report-runner.service";

/** Report generation internals, consumed by the reportQueue processor. */
@Module({
    providers: [ReportDataService, ReportStorageService, ReportRunnerService],
    exports: [ReportRunnerService, ReportStorageService],
})
export class ReportsModule {}

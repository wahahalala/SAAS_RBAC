import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@/prisma";
import { ReportDataService } from "./report-data.service";
import { ReportStorageService } from "./report-storage.service";
import { toCsv } from "./csv.writer";
import { toPdf } from "./pdf.writer";
import type { GenerateReportJob } from "@saas/shared-types";

/**
 * Executes one generate-report job: mark processing, build the artifact, record
 * the outcome on the `Report` row.
 *
 * Status handling is deliberately split from the BullMQ processor so it can be
 * unit tested with a stubbed PrismaClient. Failures are recorded on the row and
 * re-thrown, so BullMQ still applies its retry policy and the client can see why
 * a report failed.
 */
@Injectable()
export class ReportRunnerService {
    private readonly logger = new Logger(ReportRunnerService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly data: ReportDataService,
        private readonly storage: ReportStorageService,
    ) {}

    async run(job: GenerateReportJob): Promise<void> {
        const { reportId, tenantId, reportType, format } = job;

        await this.prisma.report.update({
            where: { id: reportId },
            data: {
                status: "processing",
                startedAt: new Date(),
                // Clear a previous attempt's error so a retry does not leave a
                // stale failure message on a succeeding report.
                error: null,
            },
        });

        try {
            const tenant = await this.prisma.tenant.findUnique({
                where: { id: tenantId },
                select: { name: true },
            });

            if (!tenant) {
                throw new Error(`Tenant ${tenantId} no longer exists`);
            }

            const table = await this.data.build(reportType, tenantId);

            const stored =
                format === "csv"
                    ? await this.storage.save({
                          tenantId,
                          reportId,
                          type: reportType,
                          extension: "csv",
                          content: toCsv(table),
                      })
                    : await this.storage.save({
                          tenantId,
                          reportId,
                          type: reportType,
                          extension: "pdf",
                          content: await toPdf(table, {
                              tenantName: tenant.name,
                              generatedAt: new Date(),
                          }),
                      });

            await this.prisma.report.update({
                where: { id: reportId },
                data: {
                    status: "completed",
                    filePath: stored.filePath,
                    fileName: stored.fileName,
                    fileSize: stored.fileSize,
                    rowCount: table.rows.length,
                    completedAt: new Date(),
                    error: null,
                },
            });

            this.logger.log(
                `Report ${reportId} (${reportType}/${format}) completed: ${stored.fileName} (${stored.fileSize} bytes, ${table.rows.length} rows)`,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);

            await this.prisma.report
                .update({
                    where: { id: reportId },
                    data: {
                        status: "failed",
                        error: message,
                        completedAt: new Date(),
                    },
                })
                .catch((updateError: unknown) => {
                    // Never let the bookkeeping failure hide the real cause.
                    this.logger.error(
                        `Failed to record failure for report ${reportId}: ${String(updateError)}`,
                    );
                });

            this.logger.error(`Report ${reportId} failed: ${message}`);
            throw error;
        }
    }
}

import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "@/prisma";
import { ReportDataService } from "./report-data.service";
import { ReportStorageService } from "./report-storage.service";
import { DomainEventPublisher } from "@/events";
import { toCsv } from "./csv.writer";
import { toPdf } from "./pdf.writer";
import { DOMAIN_EVENTS, type GenerateReportJob } from "@saas/shared-types";

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
        private readonly domainEvents: DomainEventPublisher,
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

            // Published AFTER the row is marked completed, so a listener can
            // read the finished report. It is deliberately OUTSIDE the try
            // below: the artifact is already written and recorded, and a
            // notification failure must not rewrite that success into a failure
            // (nor trigger a job retry that regenerates a file that exists).
            await this.publishSafely(
                {
                    tenantId,
                    actorId: job.requestedBy,
                    reportId,
                    reportType,
                    format,
                    status: "completed",
                    rowCount: table.rows.length,
                    fileSize: stored.fileSize,
                    requestedById: job.requestedBy,
                },
                reportId,
            );

            return;
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

            // A failure is a fact worth auditing/alerting on, same as success.
            await this.publishSafely(
                {
                    tenantId,
                    actorId: job.requestedBy,
                    reportId,
                    reportType,
                    format,
                    status: "failed",
                    rowCount: null,
                    fileSize: null,
                    error: message,
                    requestedById: job.requestedBy,
                },
                reportId,
            );

            this.logger.error(`Report ${reportId} failed: ${message}`);
            throw error;
        }
    }

    /**
     * Publish a domain event without letting a delivery problem change the
     * report's outcome.
     *
     * The report row is already written by the time this runs: rewriting a
     * completed report as failed (or failing the job so it regenerates a file
     * that already exists) because a notification could not be queued would be
     * strictly worse than a missing notification.
     */
    private async publishSafely(
        payload: Record<string, unknown>,
        reportId: string,
    ): Promise<void> {
        try {
            await this.domainEvents.publish(
                DOMAIN_EVENTS.REPORT_COMPLETED,
                payload,
            );
        } catch (error) {
            this.logger.error(
                `Report ${reportId} finished but its domain event could not be published: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
        }
    }
}

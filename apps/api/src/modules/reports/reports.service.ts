import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    Logger,
    NotFoundException,
} from "@nestjs/common";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import type { Report } from "@prisma/client";
import { PrismaService } from "@/prisma/prisma.service";
import { TenantContext } from "@/modules/tenant";
import { ReportQueueService } from "@/modules/queue";
import type {
    CreateReportResponse,
    ReportFormatName,
    ReportResponse,
    ReportTypeName,
} from "@saas/shared-types";

/** Reports a tenant may still be running; a new request is rejected while one exists. */
const ACTIVE_STATUSES = ["pending", "processing"] as const;

const REPORT_TYPES: ReportTypeName[] = ["usage", "members", "billing"];
const REPORT_FORMATS: ReportFormatName[] = ["csv", "pdf"];

@Injectable()
export class ReportsService {
    private readonly logger = new Logger(ReportsService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly tenantContext: TenantContext,
        private readonly reportQueue: ReportQueueService,
    ) {}

    /**
     * Create the `Report` row and enqueue the job.
     *
     * The row is written FIRST so the client always has a stable id to poll,
     * even if Redis is momentarily unavailable: the row then stays `pending`
     * with a recorded error rather than vanishing.
     */
    async create(
        requestedById: string,
        input: { type?: string; format?: string },
    ): Promise<CreateReportResponse> {
        const tenantId = this.requireTenantId();

        if (!input.type || !REPORT_TYPES.includes(input.type as ReportTypeName)) {
            throw new BadRequestException(
                `type must be one of: ${REPORT_TYPES.join(", ")}`,
            );
        }
        if (
            !input.format ||
            !REPORT_FORMATS.includes(input.format as ReportFormatName)
        ) {
            throw new BadRequestException(
                `format must be one of: ${REPORT_FORMATS.join(", ")}`,
            );
        }

        const type = input.type as ReportTypeName;
        const format = input.format as ReportFormatName;

        // One in-flight report per tenant/type/format: otherwise a user clicking
        // twice queues two identical (and expensive) builds.
        const inFlight = await this.prisma.report.findFirst({
            where: {
                tenantId,
                type,
                format,
                status: { in: [...ACTIVE_STATUSES] },
            },
        });

        if (inFlight) {
            throw new ConflictException(
                "A report with this type and format is already being generated",
            );
        }

        const report = await this.prisma.report.create({
            data: { tenantId, type, format, requestedById },
        });

        let jobId: string | null = null;
        try {
            jobId = await this.reportQueue.enqueueReport({
                reportId: report.id,
                tenantId,
                reportType: type,
                format,
                requestedBy: requestedById,
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);

            // Record it so the client is not left polling a report that will
            // never be picked up.
            await this.prisma.report.update({
                where: { id: report.id },
                data: { status: "failed", error: `Could not queue job: ${message}` },
            });

            this.logger.error(
                `Report ${report.id} created but could not be queued: ${message}`,
            );

            return {
                ...this.toResponse({
                    ...report,
                    status: "failed",
                    error: `Could not queue job: ${message}`,
                }),
                jobId: null,
            };
        }

        return { ...this.toResponse(report), jobId };
    }

    /**
     * The tenant's reports, newest first.
     *
     * Scoped by the request's tenant — one tenant's report list must never
     * include another's.
     */
    async listForTenant(): Promise<ReportResponse[]> {
        const tenantId = this.requireTenantId();

        const reports = await this.prisma.report.findMany({
            where: { tenantId },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return reports.map((report) => this.toResponse(report));
    }

    async findOne(id: string): Promise<ReportResponse> {
        return this.toResponse(await this.requireReport(id));
    }

    /**
     * Open a completed report's file as a download stream.
     *
     * `requireReport` resolves within the caller's tenant, so knowing an id is
     * not enough to read another tenant's file. The stored `filePath` is never
     * exposed to the client for the same reason.
     */
    async openDownload(id: string): Promise<{
        stream: Readable;
        fileName: string;
        fileSize: number;
    }> {
        const report = await this.requireReport(id);

        if (report.status !== "completed" || !report.filePath) {
            throw new ConflictException(
                `Report is not ready to download (status: ${report.status})`,
            );
        }

        let fileSize: number;
        try {
            const info = await stat(report.filePath);
            fileSize = info.size;
        } catch {
            // Row says completed but the artifact is gone (volume reset, manual
            // deletion). Report it as such instead of streaming a broken file.
            throw new NotFoundException("Report file is no longer available");
        }

        return {
            stream: createReadStream(report.filePath),
            fileName: report.fileName ?? `${report.type}-${report.id}`,
            fileSize,
        };
    }

    // ---------------------------------------------------------------- helpers

    private async requireReport(id: string): Promise<Report> {
        const tenantId = this.requireTenantId();

        const report = await this.prisma.report.findFirst({
            where: { id, tenantId },
        });

        if (!report) {
            throw new NotFoundException("Report not found");
        }

        return report;
    }

    private requireTenantId(): string {
        const tenantId = this.tenantContext.getTenantId();
        if (!tenantId) {
            throw new ForbiddenException(
                "Tenant context is required for this operation",
            );
        }
        return tenantId;
    }

    private toResponse(report: Report): ReportResponse {
        return {
            id: report.id,
            tenantId: report.tenantId,
            type: report.type,
            format: report.format,
            status: report.status,
            fileName: report.fileName,
            fileSize: report.fileSize,
            rowCount: report.rowCount,
            error: report.error,
            requestedById: report.requestedById,
            startedAt: report.startedAt,
            completedAt: report.completedAt,
            createdAt: report.createdAt,
        };
    }
}

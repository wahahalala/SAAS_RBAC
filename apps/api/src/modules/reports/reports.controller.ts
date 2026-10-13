import {
    Body,
    Controller,
    Get,
    Param,
    Post,
    Req,
    Res,
} from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import type { Request, Response } from "express";
import { ReportsService } from "./reports.service";
import { CreateReportDto } from "./dto";
import { CurrentUser, RequirePermission } from "@/common/decorators";

interface AuthUser {
    id: string;
    email: string;
}

/**
 * Async report generation.
 *
 * Every route is tenant-scoped (the reports belong to a tenant) and requires
 * `billing.manage`, the same permission that governs billing exports.
 */
@ApiTags("Reports")
@ApiBearerAuth()
@Controller("reports")
export class ReportsController {
    constructor(private readonly reportsService: ReportsService) {}

    @Post()
    @RequirePermission("billing.manage")
    @ApiOperation({ summary: "Request report generation (async)" })
    @ApiResponse({ status: 201, description: "Report queued" })
    @ApiResponse({ status: 409, description: "Same report already in progress" })
    async create(
        @CurrentUser() user: AuthUser,
        @Body() dto: CreateReportDto,
    ) {
        return this.reportsService.create(user.id, dto);
    }

    @Get()
    @RequirePermission("billing.manage")
    @ApiOperation({ summary: "List the tenant's reports (newest first)" })
    @ApiResponse({ status: 200, description: "Reports with their status" })
    async list() {
        return this.reportsService.listForTenant();
    }

    @Get(":id")
    @RequirePermission("billing.manage")
    @ApiOperation({ summary: "Get one report's status" })
    @ApiResponse({ status: 200, description: "Report" })
    @ApiResponse({ status: 404, description: "Not found in this tenant" })
    async findOne(@Param("id") id: string) {
        return this.reportsService.findOne(id);
    }

    @Get(":id/download")
    @RequirePermission("billing.manage")
    @ApiOperation({ summary: "Download a completed report" })
    @ApiResponse({ status: 200, description: "Report file" })
    @ApiResponse({ status: 409, description: "Report is not ready yet" })
    async download(
        @Param("id") id: string,
        @CurrentUser() user: AuthUser,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        // The actor is passed so the export is attributed to whoever actually
        // downloaded it, which may differ from who requested the report.
        const { stream, fileName, fileSize } =
            await this.reportsService.openDownload(id, user.id, {
                ipAddress:
                    req.ip ||
                    (req.headers["x-forwarded-for"] as string)?.split(",")[0],
                userAgent: req.headers["user-agent"],
            });

        res.setHeader("Content-Type", contentTypeFor(fileName));
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${sanitizeFileName(fileName)}"`,
        );
        res.setHeader("Content-Length", String(fileSize));

        stream.pipe(res);
    }
}

function contentTypeFor(fileName: string): string {
    return fileName.endsWith(".pdf") ? "application/pdf" : "text/csv; charset=utf-8";
}

/**
 * Keep the filename header-safe: a quote or newline in it would let a crafted
 * name break out of the header value.
 */
function sanitizeFileName(fileName: string): string {
    return fileName.replace(/["\r\n\\]/g, "_");
}

import { Controller, Get, Query } from "@nestjs/common";
import {
    ApiBearerAuth,
    ApiOperation,
    ApiResponse,
    ApiTags,
} from "@nestjs/swagger";
import { AuditService } from "./audit.service";
import { AuditLogQueryDto } from "./dto";
import { RequirePermission } from "@/common/decorators";

/**
 * Tenant audit trail.
 *
 * Requires `audit.read` (administrator capability): it exposes who did what
 * across the whole tenant, including every login and data export.
 */
@ApiTags("Audit")
@ApiBearerAuth()
@Controller("audit-logs")
export class AuditController {
    constructor(private readonly auditService: AuditService) {}

    @Get()
    @RequirePermission("audit.read")
    @ApiOperation({ summary: "List the tenant's audit log (paginated, filterable)" })
    @ApiResponse({ status: 200, description: "Page of audit entries, newest first" })
    @ApiResponse({ status: 400, description: "Invalid filter value" })
    @ApiResponse({ status: 403, description: "Missing audit.read" })
    async list(@Query() query: AuditLogQueryDto) {
        return this.auditService.list(query);
    }
}

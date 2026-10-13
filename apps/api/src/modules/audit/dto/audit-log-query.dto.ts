import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
    IsIn,
    IsISO8601,
    IsOptional,
    IsString,
    IsUUID,
    MaxLength,
} from "class-validator";
import { AUDIT_ACTION_VALUES } from "@saas/shared-types";

/**
 * Query filters for the audit log list.
 *
 * Extends the shared pagination DTO, so `page`/`limit` behave exactly as
 * everywhere else (1-indexed, max 100 per page).
 *
 * All filters are optional and combine with AND. They are validated rather than
 * passed through: `action` selects a database predicate, and an arbitrary string
 * would silently return nothing instead of telling the caller they typo'd.
 */
export class AuditLogQueryDto {
    @ApiPropertyOptional({ description: "Page number (1-indexed)", default: 1 })
    @IsOptional()
    @Type(() => Number)
    page?: number = 1;

    @ApiPropertyOptional({
        description: "Items per page",
        default: 20,
        maximum: 100,
    })
    @IsOptional()
    @Type(() => Number)
    limit?: number = 20;

    @ApiPropertyOptional({
        enum: AUDIT_ACTION_VALUES,
        description: "Filter by action",
    })
    @IsOptional()
    @IsString()
    @IsIn(AUDIT_ACTION_VALUES, {
        message: `action must be one of: ${AUDIT_ACTION_VALUES.join(", ")}`,
    })
    action?: string;

    @ApiPropertyOptional({ description: "Filter by the actor's user id" })
    @IsOptional()
    @IsUUID()
    userId?: string;

    @ApiPropertyOptional({ description: "Filter by entity type, e.g. User" })
    @IsOptional()
    @IsString()
    @MaxLength(64)
    entity?: string;

    @ApiPropertyOptional({ description: "Filter by entity id" })
    @IsOptional()
    @IsString()
    @MaxLength(128)
    entityId?: string;

    @ApiPropertyOptional({
        description: "Only entries at or after this ISO-8601 timestamp",
        example: "2026-01-01T00:00:00.000Z",
    })
    @IsOptional()
    @IsISO8601()
    from?: string;

    @ApiPropertyOptional({
        description: "Only entries at or before this ISO-8601 timestamp",
        example: "2026-12-31T23:59:59.999Z",
    })
    @IsOptional()
    @IsISO8601()
    to?: string;

    @ApiPropertyOptional({
        description:
            "Free-text search over the action, entity type, entity id, actor email/name and metadata",
        example: "EXPORT_DATA",
    })
    @IsOptional()
    @IsString()
    @MaxLength(200)
    search?: string;
}

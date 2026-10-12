import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsOptional, Max, Min } from "class-validator";

/**
 * Base pagination query DTO
 */
export class PaginationQueryDto {
    @ApiPropertyOptional({
        description: "Page number (1-indexed)",
        default: 1,
        minimum: 1,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({
        description: "Number of items per page",
        default: 20,
        minimum: 1,
        maximum: 100,
    })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;
}

/**
 * Pagination metadata for responses
 */
export class PaginationMeta {
    @ApiProperty({ description: "Current page number" })
    page: number;

    @ApiProperty({ description: "Items per page" })
    limit: number;

    @ApiProperty({ description: "Total number of items" })
    total: number;

    @ApiProperty({ description: "Total number of pages" })
    totalPages: number;

    @ApiProperty({ description: "Whether there are more pages" })
    hasMore: boolean;

    constructor(page: number, limit: number, total: number) {
        this.page = page;
        this.limit = limit;
        this.total = total;
        this.totalPages = Math.ceil(total / limit);
        this.hasMore = page < this.totalPages;
    }
}

/**
 * Standard API response wrapper
 */
export interface ApiResponseDto<T> {
    success: boolean;
    data: T;
    meta?: PaginationMeta;
}

/**
 * Standard error response
 */
export interface ApiErrorDto {
    success: false;
    error: {
        code: string;
        message: string;
        statusCode: number;
        details?: Array<{ field?: string; message: string }>;
    };
    timestamp: string;
    path: string;
}


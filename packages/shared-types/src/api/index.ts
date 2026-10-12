/**
 * API envelope types shared by the API and the web API client.
 */

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    meta?: PaginationMeta;
}

export interface PaginationMeta {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasMore?: boolean;
}

export interface ApiErrorResponse {
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

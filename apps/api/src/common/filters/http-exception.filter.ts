import {
    ExceptionFilter,
    Catch,
    ArgumentsHost,
    HttpException,
    HttpStatus,
} from "@nestjs/common";
import { Request, Response } from "express";

interface ErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        statusCode: number;
        details?: Record<string, unknown>[];
    };
    timestamp: string;
    path: string;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message = "Internal server error";
        let code = "INTERNAL_ERROR";
        let details: Record<string, unknown>[] | undefined;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const exceptionResponse = exception.getResponse();

            if (typeof exceptionResponse === "string") {
                message = exceptionResponse;
            } else if (typeof exceptionResponse === "object") {
                const responseObj = exceptionResponse as Record<string, unknown>;
                message = (responseObj.message as string) || message;

                // Handle validation errors
                if (Array.isArray(responseObj.message)) {
                    message = "Validation failed";
                    details = responseObj.message.map((msg: string) => ({ message: msg }));
                }
            }

            code = this.getErrorCode(status);
        }

        const errorResponse: ErrorResponse = {
            success: false,
            error: {
                code,
                message,
                statusCode: status,
                ...(details && { details }),
            },
            timestamp: new Date().toISOString(),
            path: request.url,
        };

        response.status(status).json(errorResponse);
    }

    private getErrorCode(status: number): string {
        const codeMap: Record<number, string> = {
            400: "BAD_REQUEST",
            401: "UNAUTHORIZED",
            403: "FORBIDDEN",
            404: "NOT_FOUND",
            409: "CONFLICT",
            422: "VALIDATION_ERROR",
            429: "TOO_MANY_REQUESTS",
            500: "INTERNAL_ERROR",
        };

        return codeMap[status] || "UNKNOWN_ERROR";
    }
}

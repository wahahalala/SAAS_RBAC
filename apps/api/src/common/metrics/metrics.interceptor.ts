import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { MetricsService } from "./metrics.service";

/**
 * Counts every HTTP request by method, route and outcome, and records its
 * duration. Registered as an APP_INTERCEPTOR so it wraps the whole pipeline
 * (guards, pipes, handlers) — a request rejected by TenantGuard still shows up
 * as `{status="403"}`.
 *
 * The work is deliberately minimal and allocation-free in the hot path: labels
 * are pre-computed and the counters are plain in-memory numbers behind
 * `MetricsService`, which `/metrics` serialises into Prometheus text format.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
    constructor(private readonly metrics: MetricsService) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const request = context.switchToHttp().getRequest();
        const startAt = process.hrtime.bigint();

        const route = (request.route?.path ?? "unmatched") as string;
        const method = (request.method ?? "UNKNOWN") as string;

        return next.handle().pipe(
            tap(() => {
                const status = request.res?.statusCode ?? 200;
                this.metrics.recordRequest(method, route, String(status), startAt);
            }),
            catchError((error: unknown) => {
                // Errors are re-thrown for the exception filter; we only observe.
                const status =
                    (error as { status?: number })?.status ??
                    (request.res?.statusCode ?? 500);
                this.metrics.recordRequest(method, route, String(status), startAt);
                throw error;
            }),
        );
    }
}

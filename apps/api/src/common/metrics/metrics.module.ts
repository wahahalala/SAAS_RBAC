import { Global, Module } from "@nestjs/common";
import { MetricsService } from "./metrics.service";
import { MetricsController } from "./metrics.controller";
import { MetricsInterceptor } from "./metrics.interceptor";

/**
 * Prometheus metrics (hand-rolled registry + an APP_INTERCEPTOR that feeds it).
 *
 * `MetricsService` is exported so the interceptor and controller share one
 * registry instance; controllers are registered here so the `/metrics` route
 * exists on the API's global prefix.
 */
@Global()
@Module({
    controllers: [MetricsController],
    providers: [MetricsService, MetricsInterceptor],
    exports: [MetricsService],
})
export class MetricsModule {}

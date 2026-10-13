import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Public } from "@/common/decorators";
import { MetricsService } from "@/common/metrics/metrics.service";

/**
 * Prometheus exposition endpoint.
 *
 * `GET /api/v1/metrics` returns the in-process counters/histograms in text
 * format for a Prometheus scrape config:
 *
 *   scrape_configs:
 *     - job_name: saas-api
 *       static_configs:
 *         - targets: ["api:3001"]
 *       metrics_path: /api/v1/metrics
 *
 * Marked `@Public()` so an unauthenticated scrape succeeds, and deliberately
 * NOT tenant-scoped (it reports request counts by route, never tenant data).
 * Production deployments must keep this endpoint off the public internet —
 * `docker-compose.prod.yml` puts Prometheus on the internal network and does not
 * expose the API port; if you publish it, gate `/metrics` at the proxy.
 */
@ApiTags("Metrics")
@Controller("metrics")
export class MetricsController {
    constructor(private readonly metrics: MetricsService) {}

    @Get()
    @Public()
    @Header("Content-Type", "text/plain; version=0.0.4")
    @ApiOperation({ summary: "Prometheus metrics" })
    render(): string {
        return this.metrics.renderAll();
    }
}

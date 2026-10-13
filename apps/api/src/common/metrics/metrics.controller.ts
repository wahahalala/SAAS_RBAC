import { Controller, Get, Header } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
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
 * This endpoint is behind the API's own auth by default (it lives under the
 * global guards), so a production scrape job must either be given a token or
 * the endpoint be marked public + protected by the network. The Compose file
 * puts Prometheus on an internal network, so the endpoint is left unscoped.
 */
@ApiTags("Metrics")
@Controller("metrics")
export class MetricsController {
    constructor(private readonly metrics: MetricsService) {}

    @Get()
    @Header("Content-Type", "text/plain; version=0.0.4")
    @ApiOperation({ summary: "Prometheus metrics" })
    render(): string {
        return this.metrics.renderAll();
    }
}

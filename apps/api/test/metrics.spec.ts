import { describe, it, expect, beforeEach } from "vitest";
import { MetricsService } from "@/common/metrics/metrics.service";

/**
 * The hand-rolled Prometheus registry.
 *
 * The `/metrics` endpoint is the API's observability surface, so the text it
 * emits must stay a valid Prometheus exposition: one HELP/TYPE per metric, then
 * labelled samples. Counter semantics (monotonic within a process) and the
 * histogram's cumulative buckets are the two things a scrape job depends on.
 */
describe("MetricsService", () => {
    let metrics: MetricsService;

    beforeEach(() => {
        metrics = new MetricsService();
    });

    it("counts requests by method, route and status", () => {
        metrics.recordRequest("GET", "/api/v1/projects", "200", process.hrtime.bigint());
        metrics.recordRequest("GET", "/api/v1/projects", "200", process.hrtime.bigint());
        metrics.recordRequest("GET", "/api/v1/projects", "403", process.hrtime.bigint());

        const text = metrics.renderAll();

        expect(text).toContain(
            'http_requests_total{method="GET",route="/api/v1/projects",status="200"} 2',
        );
        expect(text).toContain(
            'http_requests_total{method="GET",route="/api/v1/projects",status="403"} 1',
        );
    });

    it("renders cumulative histogram buckets", () => {
        metrics.recordRequest("POST", "/api/v1/projects", "201", process.hrtime.bigint());

        const text = metrics.renderAll();

        expect(text).toContain("# TYPE http_request_duration_bucket histogram");
        // A fast request lands in the smallest bucket, so every larger bucket
        // contains it too (cumulative = "le" semantics).
        expect(text).toContain(
            'http_request_duration_bucket{method="POST",route="/api/v1/projects",le="5"} 1',
        );
        expect(text).toContain(
            'http_request_duration_bucket{method="POST",route="/api/v1/projects",le="2500"} 1',
        );
        expect(text).toContain(
            'http_request_duration_bucket{method="POST",route="/api/v1/projects",le="+Inf"} 1',
        );
    });

    it("reset clears all observations", () => {
        metrics.recordRequest("GET", "/api/v1/health", "200", process.hrtime.bigint());
        metrics.reset();

        expect(metrics.renderAll()).not.toContain('http_requests_total{');
    });
});

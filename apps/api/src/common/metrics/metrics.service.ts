import { Injectable } from "@nestjs/common";

/**
 * Minimal in-process Prometheus metrics registry.
 *
 * Holds counters and histograms in plain maps and renders the Prometheus text
 * exposition format on demand. This is intentionally dependency-free: the
 * standard `prom-client` library would also be fine here, but a hand-rolled
 * registry keeps the production image lean and the exposition endpoint easy to
 * reason about.
 *
 * Counters are monotonically increasing until process restart; histograms are
 * fixed bounded buckets. The labels observed (method, route, status) are all
 * low-cardinality by construction — never request paths with tenant slugs or
 * user ids, which would explode the series count.
 */

export interface RequestMetrics {
    /** method + route + status → count */
    counter: Map<string, number>;
    /** method + route → per-bucket duration counts (ms) */
    histogram: Map<string, number[]>;
}

// Explicit bucket edges in milliseconds. log-linear, roughly matching the
// request latencies seen in the e2e suite.
const DURATION_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1000, 2500];

@Injectable()
export class MetricsService {
    private readonly requests = new Map<string, number>();
    private readonly durations = new Map<string, number[]>();

    /** Record one finished request. */
    recordRequest(
        method: string,
        route: string,
        status: string,
        startedAt: bigint,
    ): void {
        const key = `${method}::${route}::${status}`;
        this.requests.set(key, (this.requests.get(key) ?? 0) + 1);

        const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
        const bucketKey = `${method}::${route}`;
        const buckets = this.durations.get(bucketKey) ?? Array(DURATION_BUCKETS_MS.length).fill(0);
        const index = DURATION_BUCKETS_MS.findIndex((edge) => durationMs <= edge);
        if (index >= 0) {
            buckets[index] += 1;
        }
        this.durations.set(bucketKey, buckets);
    }

    /** Render the registered metrics in Prometheus text format. */
    renderAll(): string {
        const lines: string[] = [];

        lines.push("# HELP http_requests_total Total HTTP requests handled by the API.");
        lines.push("# TYPE http_requests_total counter");
        for (const [key, count] of this.requests.entries()) {
            const [method, route, status] = key.split("::");
            lines.push(
                `http_requests_total{method="${method}",route="${route}",status="${status}"} ${count}`,
            );
        }

        lines.push("# HELP http_request_duration_bucket Request duration in milliseconds.");
        lines.push("# TYPE http_request_duration_bucket histogram");
        for (const [key, buckets] of this.durations.entries()) {
            const [method, route] = key.split("::");
            let cumulative = 0;
            DURATION_BUCKETS_MS.forEach((edge, i) => {
                cumulative += buckets[i] ?? 0;
                lines.push(
                    `http_request_duration_bucket{method="${method}",route="${route}",le="${edge}"} ${cumulative}`,
                );
            });
            lines.push(
                `http_request_duration_bucket{method="${method}",route="${route}",le="+Inf"} ${cumulative}`,
            );
        }

        lines.push("");
        return lines.join("\n");
    }

    /** Drop all observations (used by tests). */
    reset(): void {
        this.requests.clear();
        this.durations.clear();
    }
}

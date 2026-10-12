import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Report endpoints are tenant-scoped, and downloads must carry credentials.
 *
 * A regression here is silent: the request would look fine in the network tab
 * but the API would answer 403 (missing tenant) or the browser would fetch an
 * unauthenticated URL.
 */

function installLocalStorage() {
    const store = new Map<string, string>();
    (globalThis as any).window = {
        localStorage: {
            getItem: (k: string) => store.get(k) ?? null,
            setItem: (k: string, v: string) => void store.set(k, v),
            removeItem: (k: string) => void store.delete(k),
        },
    };
}

const fetchMock = vi.fn();

beforeEach(() => {
    vi.resetModules();
    installLocalStorage();
    fetchMock.mockReset();
    fetchMock.mockImplementation(async () =>
        new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function requestOf(index = 0): { url: string; init: RequestInit } {
    const call = fetchMock.mock.calls[index]!;
    return { url: String(call[0]), init: call[1] as RequestInit };
}

function headersOf(index = 0): Record<string, string> {
    return requestOf(index).init.headers as Record<string, string>;
}

async function load() {
    const { apiClient } = await import("@/lib/api-client");
    const tenantTokens = await import("@/lib/tenant-tokens");
    return { apiClient, tenantTokens };
}

describe("report api-client calls", () => {
    it("scopes report requests to the active tenant", async () => {
        const { apiClient, tenantTokens } = await load();
        tenantTokens.setActiveTenantId("tenant-a");

        await apiClient.listReports();
        await apiClient.getReport("report-1");
        await apiClient.createReport({ type: "usage", format: "csv" });

        for (const index of [0, 1, 2]) {
            expect(headersOf(index)["X-Tenant-Id"]).toBe("tenant-a");
        }
    });

    it("POSTs the requested type and format", async () => {
        const { apiClient, tenantTokens } = await load();
        tenantTokens.setActiveTenantId("tenant-a");

        await apiClient.createReport({ type: "members", format: "pdf" });

        const { init } = requestOf();
        expect(init.method).toBe("POST");
        expect(JSON.parse(String(init.body))).toEqual({
            type: "members",
            format: "pdf",
        });
    });

    it("sends credentials when downloading", async () => {
        const { apiClient, tenantTokens } = await load();
        tenantTokens.setActiveTenantId("tenant-a");

        // The download endpoint is authenticated, so the bearer token and the
        // tenant header must both be present - otherwise it 401s/403s.
        fetchMock.mockResolvedValueOnce(
            new Response("a,b\r\n1,2\r\n", {
                status: 200,
                headers: {
                    "Content-Type": "text/csv",
                    "Content-Disposition": 'attachment; filename="usage-report.csv"',
                },
            }),
        );

        const result = await apiClient.downloadReport("report-1");

        const { url, init } = requestOf();
        expect(url).toContain("/reports/report-1/download");
        expect(headersOf()["X-Tenant-Id"]).toBe("tenant-a");
        expect(init.credentials).toBe("include");
        expect(result.fileName).toBe("usage-report.csv");
        expect(result.blob.size).toBeGreaterThan(0);
    });

    it("falls back to a generic name when the header has no filename", async () => {
        const { apiClient, tenantTokens } = await load();
        tenantTokens.setActiveTenantId("tenant-a");

        fetchMock.mockResolvedValueOnce(
            new Response("%PDF-1.3", { status: 200 }),
        );

        const result = await apiClient.downloadReport("report-2");
        expect(result.fileName).toBe("report");
    });

    it("surfaces an API error instead of returning an empty blob", async () => {
        const { apiClient, tenantTokens } = await load();
        tenantTokens.setActiveTenantId("tenant-a");

        fetchMock.mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    message: "Report is not ready to download (status: pending)",
                }),
                { status: 409, headers: { "Content-Type": "application/json" } },
            ),
        );

        await expect(apiClient.downloadReport("report-3")).rejects.toThrow(
            /not ready to download/i,
        );
    });
});

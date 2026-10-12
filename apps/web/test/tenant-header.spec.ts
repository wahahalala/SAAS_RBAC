import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The API's TenantGuard rejects tenant-bound routes with 403 when the
 * `X-Tenant-Id` header is missing, so the client must attach it. At the same
 * time, the tenant-discovery routes (@SkipTenantCheck) must keep working
 * BEFORE a tenant is chosen — otherwise the user could never pick one.
 *
 * This suite asserts both, plus that the header follows a tenant switch.
 */

/** Minimal localStorage so the suite runs in a plain node environment. */
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
    // A fresh Response per call: a body can only be consumed once.
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

async function loadClient() {
    const { apiClient } = await import("@/lib/api-client");
    const tenantTokens = await import("@/lib/tenant-tokens");
    return { apiClient, tenantTokens };
}

function headersOf(callIndex = 0): Record<string, string> {
    return (fetchMock.mock.calls[callIndex]![1] as RequestInit)
        .headers as Record<string, string>;
}

describe("api-client tenant header", () => {
    it("sends X-Tenant-Id on tenant-bound requests", async () => {
        const { apiClient, tenantTokens } = await loadClient();
        tenantTokens.setActiveTenantId("tenant-a");

        await apiClient.getMyPermissions();

        expect(headersOf()["X-Tenant-Id"]).toBe("tenant-a");
    });

    it("omits X-Tenant-Id on tenant-discovery requests", async () => {
        const { apiClient, tenantTokens } = await loadClient();
        tenantTokens.setActiveTenantId("tenant-a");

        await apiClient.getOrganizations();
        await apiClient.getMe();
        await apiClient.createOrganization({ name: "New Org" });

        for (const index of [0, 1, 2]) {
            expect(headersOf(index)["X-Tenant-Id"]).toBeUndefined();
        }
    });

    it("does not send a tenant header when no tenant is selected yet", async () => {
        const { apiClient } = await loadClient();

        await apiClient.getMyPermissions();

        expect(headersOf()["X-Tenant-Id"]).toBeUndefined();
    });

    it("follows a tenant switch", async () => {
        const { apiClient, tenantTokens } = await loadClient();

        tenantTokens.setActiveTenantId("tenant-a");
        await apiClient.getMyPermissions();
        tenantTokens.setActiveTenantId("tenant-b");
        await apiClient.getMyPermissions();

        expect(headersOf(0)["X-Tenant-Id"]).toBe("tenant-a");
        expect(headersOf(1)["X-Tenant-Id"]).toBe("tenant-b");
    });
});

describe("api-client 401 retry", () => {
    it("keeps the original tenant when the user switches mid-flight", async () => {
        const { apiClient, tenantTokens } = await loadClient();
        tenantTokens.setActiveTenantId("tenant-a");

        // First call 401s (so the client refreshes + retries), the refresh
        // itself succeeds, and the retry returns 200.
        fetchMock.mockImplementation(async (url: string) => {
            if (String(url).endsWith("/auth/refresh")) {
                return new Response(JSON.stringify({ accessToken: "fresh-token" }), {
                    status: 200,
                    headers: { "Content-Type": "application/json" },
                });
            }

            const first = fetchMock.mock.calls.length === 1;
            if (first) {
                // The user switches tenant while this request is in flight.
                tenantTokens.setActiveTenantId("tenant-b");
                return new Response("{}", { status: 401 });
            }

            return new Response(JSON.stringify({ ok: true }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        });

        await apiClient.getMyPermissions();

        // The retry must stay on tenant-a: retargeting it at tenant-b would
        // cache tenant-b's response under tenant-a's request.
        expect(headersOf(0)["X-Tenant-Id"]).toBe("tenant-a");
        expect(headersOf(2)["X-Tenant-Id"]).toBe("tenant-a");
    });
});

describe("tenant-tokens persistence", () => {
    it("survives a module reload (simulated page refresh)", async () => {
        const { tenantTokens } = await loadClient();
        tenantTokens.setActiveTenantId("tenant-persisted");
        expect((globalThis as any).window.localStorage.getItem("saas.activeTenantId"))
            .toBe("tenant-persisted");

        vi.resetModules();
        const reloaded = await import("@/lib/tenant-tokens");
        expect(reloaded.getActiveTenantId()).toBe("tenant-persisted");
    });

    it("clears the selection on logout", async () => {
        const { tenantTokens } = await loadClient();
        tenantTokens.setActiveTenantId("tenant-a");

        const { useTenantStore } = await import("@/lib/stores/tenant-store");
        useTenantStore.getState().clearActiveTenant();

        expect(tenantTokens.getActiveTenantId()).toBeNull();
        expect((globalThis as any).window.localStorage.getItem("saas.activeTenantId"))
            .toBeNull();
    });
});

describe("useTenantStore.reconcileActiveTenant", () => {
    async function loadStore() {
        const { useTenantStore } = await import("@/lib/stores/tenant-store");
        return useTenantStore;
    }

    it("keeps a still-valid persisted tenant", async () => {
        const { tenantTokens } = await loadClient();
        tenantTokens.setActiveTenantId("tenant-b");
        const store = await loadStore();

        const next = store.getState().reconcileActiveTenant(["tenant-a", "tenant-b"]);

        expect(next).toBe("tenant-b");
        expect(store.getState().activeTenantId).toBe("tenant-b");
    });

    it("falls back to the first organisation when the stored tenant is gone", async () => {
        const { tenantTokens } = await loadClient();
        tenantTokens.setActiveTenantId("tenant-removed");
        const store = await loadStore();

        const next = store.getState().reconcileActiveTenant(["tenant-a", "tenant-b"]);

        expect(next).toBe("tenant-a");
        expect(tenantTokens.getActiveTenantId()).toBe("tenant-a");
    });

    it("resolves to no tenant when the user has no memberships", async () => {
        const { tenantTokens } = await loadClient();
        tenantTokens.setActiveTenantId("tenant-stale");
        const store = await loadStore();

        expect(store.getState().reconcileActiveTenant([])).toBeNull();
        expect(tenantTokens.getActiveTenantId()).toBeNull();
    });
});

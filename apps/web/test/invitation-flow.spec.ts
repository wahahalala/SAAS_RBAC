import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Two guarantees for the invitation accept flow:
 *
 *  1. The invitation endpoints must NOT carry `X-Tenant-Id`: the token is the
 *     tenant selector, and a brand-new invitee has no active tenant yet — the
 *     API's TenantGuard would reject the call with 403 if the header were
 *     required.
 *  2. Deep-linking after sign-in must not become an open redirect.
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

function headersOf(callIndex = 0): Record<string, string> {
    return (fetchMock.mock.calls[callIndex]![1] as RequestInit)
        .headers as Record<string, string>;
}

function urlOf(callIndex = 0): string {
    return String(fetchMock.mock.calls[callIndex]![0]);
}

describe("invitation api-client calls", () => {
    it("fetches an invitation preview without a tenant header", async () => {
        const { apiClient } = await import("@/lib/api-client");
        const { setActiveTenantId } = await import("@/lib/tenant-tokens");

        // Even if a tenant happens to be selected for another org, the
        // invitation call must not be scoped by it.
        setActiveTenantId("tenant-other");

        await apiClient.getInvitation("tok-123");

        expect(urlOf()).toContain("/invitations/tok-123");
        expect(headersOf()["X-Tenant-Id"]).toBeUndefined();
    });

    it("accepts an invitation without a tenant header", async () => {
        const { apiClient } = await import("@/lib/api-client");
        const { setActiveTenantId } = await import("@/lib/tenant-tokens");
        setActiveTenantId("tenant-other");

        await apiClient.acceptInvitation("tok-123");

        expect(urlOf()).toContain("/invitations/tok-123/accept");
        expect(headersOf()["X-Tenant-Id"]).toBeUndefined();
        expect((fetchMock.mock.calls[0]![1] as RequestInit).method).toBe("POST");
    });

    it("still scopes admin invitation routes to the active tenant", async () => {
        const { apiClient } = await import("@/lib/api-client");
        const { setActiveTenantId } = await import("@/lib/tenant-tokens");
        setActiveTenantId("tenant-a");

        await apiClient.listInvitations("acme");
        await apiClient.revokeInvitation("acme", "inv-1");

        // TENANT-SCOPED: these operate on a tenant's own invitations, so
        // TenantGuard must be able to authorise them.
        expect(headersOf(0)["X-Tenant-Id"]).toBe("tenant-a");
        expect(headersOf(1)["X-Tenant-Id"]).toBe("tenant-a");
    });
});

describe("safeRedirectTarget", () => {
    async function load() {
        const { safeRedirectTarget } = await import("@/hooks/use-auth");
        return safeRedirectTarget;
    }

    it("honours an absolute same-origin path", async () => {
        const target = await load();
        expect(target("/invitations/tok-123")).toBe("/invitations/tok-123");
    });

    it("falls back when no redirect is given", async () => {
        const target = await load();
        expect(target(null)).toBe("/dashboard");
        expect(target(undefined)).toBe("/dashboard");
    });

    it.each([
        ["https://evil.example/steal", "absolute URL"],
        ["//evil.example/steal", "protocol-relative URL"],
        ["http://localhost:3000/dashboard", "absolute URL with host"],
        ["javascript:alert(1)", "javascript: URL"],
    ])("refuses %s (%s)", async (candidate) => {
        const target = await load();
        // An attacker-supplied ?redirect= must not bounce the user off-site.
        expect(target(candidate)).toBe("/dashboard");
    });

    it("accepts a caller-provided fallback", async () => {
        const target = await load();
        expect(target("//evil.example", "/login")).toBe("/login");
    });
});

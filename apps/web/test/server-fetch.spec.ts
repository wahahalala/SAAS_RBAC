import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

/**
 * Server-side data access.
 *
 * The tenant header and the error contract are the two things that must not
 * regress: a missing tenant header would make every scoped fetch fail with 403,
 * and a thrown error would replace a whole route with an error boundary instead
 * of showing a message inside a working page.
 *
 * `next/headers` and the session layer are mocked so this tests the fetch
 * construction rather than the framework.
 */

const cookiesMock = vi.fn();

vi.mock("next/headers", () => ({
    cookies: () => cookiesMock(),
}));

const getServerSessionMock = vi.fn();

vi.mock("@/lib/server/session", () => ({
    getServerSession: () => getServerSessionMock(),
    persistRotatedRefreshToken: async () => undefined,
}));

const fetchMock = vi.fn();

beforeEach(() => {
    vi.resetModules();
    fetchMock.mockReset();
    getServerSessionMock.mockReset();
    cookiesMock.mockReset();

    vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
    vi.unstubAllGlobals();
});

function cookieStore(values: Record<string, string>) {
    return {
        get: (name: string) =>
            values[name] ? { name, value: values[name] } : undefined,
        getAll: () => Object.entries(values).map(([name, value]) => ({ name, value })),
        set: () => undefined,
        delete: () => undefined,
        toString: () =>
            Object.entries(values)
                .map(([k, v]) => `${k}=${v}`)
                .join("; "),
    };
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

async function loadApi() {
    return import("@/lib/server/api");
}

describe("serverFetch", () => {
    it("attaches the bearer token and the active tenant header", async () => {
        getServerSessionMock.mockResolvedValue({
            accessToken: "access-token",
            user: { id: "u1" },
        });
        cookiesMock.mockResolvedValue(cookieStore({ "saas.activeTenantId": "tenant-a" }));
        fetchMock.mockResolvedValue(jsonResponse([{ id: "org-1" }]));

        const { serverFetch } = await loadApi();
        const result = await serverFetch("/organizations/acme/members");

        expect(result.error).toBeNull();
        expect(result.data).toEqual([{ id: "org-1" }]);

        const [url, init] = fetchMock.mock.calls[0]!;
        const headers = (init as RequestInit).headers as Record<string, string>;

        expect(String(url)).toContain("/api/v1/organizations/acme/members");
        expect(headers.Authorization).toBe("Bearer access-token");
        // Without this the API rejects the request with 403.
        expect(headers["X-Tenant-Id"]).toBe("tenant-a");
    });

    it("omits the tenant header for user-level endpoints", async () => {
        getServerSessionMock.mockResolvedValue({
            accessToken: "access-token",
            user: { id: "u1" },
        });
        cookiesMock.mockResolvedValue(cookieStore({ "saas.activeTenantId": "tenant-a" }));
        fetchMock.mockResolvedValue(jsonResponse([]));

        const { serverFetch } = await loadApi();
        await serverFetch("/users/me/organizations", { tenantId: null });

        const headers = (fetchMock.mock.calls[0]![1] as RequestInit)
            .headers as Record<string, string>;

        // Tenant discovery must work before a tenant is chosen.
        expect(headers["X-Tenant-Id"]).toBeUndefined();
        expect(headers.Authorization).toBe("Bearer access-token");
    });

    it("reports 'Not authenticated' without calling the API", async () => {
        getServerSessionMock.mockResolvedValue(null);

        const { serverFetch } = await loadApi();
        const result = await serverFetch("/users/me");

        expect(result.data).toBeNull();
        expect(result.error).toBe("Not authenticated");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("returns the API's error message instead of throwing", async () => {
        getServerSessionMock.mockResolvedValue({
            accessToken: "access-token",
            user: { id: "u1" },
        });
        cookiesMock.mockResolvedValue(cookieStore({ "saas.activeTenantId": "tenant-a" }));
        fetchMock.mockResolvedValue(
            jsonResponse({ error: { message: "Not a member of this tenant" } }, 403),
        );

        const { serverFetch } = await loadApi();
        const result = await serverFetch("/organizations/acme");

        // A thrown error would blow up the whole route; a page should be able to
        // render this inline.
        expect(result.data).toBeNull();
        expect(result.error).toBe("Not a member of this tenant");
    });

    it("treats a network failure as data, not an exception", async () => {
        getServerSessionMock.mockResolvedValue({
            accessToken: "access-token",
            user: { id: "u1" },
        });
        cookiesMock.mockResolvedValue(cookieStore({ "saas.activeTenantId": "tenant-a" }));
        fetchMock.mockRejectedValue(new Error("ECONNREFUSED"));

        const { serverFetch } = await loadApi();
        const result = await serverFetch("/users/me");

        expect(result.error).toBe("ECONNREFUSED");
        expect(result.data).toBeNull();
    });

    it("never caches per-user data by default", async () => {
        getServerSessionMock.mockResolvedValue({
            accessToken: "access-token",
            user: { id: "u1" },
        });
        cookiesMock.mockResolvedValue(cookieStore({ "saas.activeTenantId": "tenant-a" }));
        fetchMock.mockResolvedValue(jsonResponse([]));

        const { serverFetch } = await loadApi();
        await serverFetch("/users/me");

        // A cached response would leak one user's data to the next.
        expect((fetchMock.mock.calls[0]![1] as RequestInit).cache).toBe("no-store");
    });
});

describe("serverFetchOrThrow", () => {
    it("returns the data on success", async () => {
        getServerSessionMock.mockResolvedValue({
            accessToken: "access-token",
            user: { id: "u1" },
        });
        cookiesMock.mockResolvedValue(cookieStore({ "saas.activeTenantId": "tenant-a" }));
        fetchMock.mockResolvedValue(jsonResponse({ id: "u1" }));

        const { serverFetchOrThrow } = await loadApi();
        await expect(serverFetchOrThrow("/users/me")).resolves.toEqual({ id: "u1" });
    });

    it("throws when the fetch failed", async () => {
        getServerSessionMock.mockResolvedValue(null);

        const { serverFetchOrThrow } = await loadApi();
        // For data a page cannot render without, failing loudly is correct.
        await expect(serverFetchOrThrow("/users/me")).rejects.toThrow(
            /Not authenticated/,
        );
    });
});

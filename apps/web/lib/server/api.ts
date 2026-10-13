import { cache } from "react";
import type { OrganizationMembershipResponse } from "@saas/shared-types";
import { getActiveTenantId } from "./tenant-cookie";
import { getServerSession } from "./session";
import { selfOrigin } from "./origin";

/**
 * Server-side data access for Server Components.
 *
 * One function instead of a per-endpoint client: every server fetch has the same
 * three concerns (authenticate, scope to the tenant, decide caching), and
 * centralising them means a page cannot accidentally forget the tenant header.
 *
 * Errors are returned as `{ data, error }` rather than thrown, because a Server
 * Component that throws replaces the whole route with an error boundary. A
 * failed list request should render "could not load" inside a working page.
 */

const API_BASE = "/api/v1";

/**
 * The tenant a *default* (tenant-scoped) fetch is scoped to.
 *
 * The cookie is the user's explicit choice, but it is cleared on sign-in (the
 * previous account's tenants are meaningless), so immediately after login it is
 * empty even though the caller does belong to an organization. Reconciling the
 * same way the dashboard does — keep the cookie while it still names one of the
 * caller's memberships, otherwise use the first — is what keeps every scoped
 * request working (team data, billing permissions, the reports route) before the
 * user ever opens the switcher.
 *
 * `cache()` resolves this at most once per render, however many `serverFetch`
 * calls ask for it. Outside a React request (unit tests, scripts) it degrades to
 * a plain call.
 */
export const resolveActiveTenantId = cache(async (): Promise<string | null> => {
    const explicitTenantId = await getActiveTenantId();
    if (explicitTenantId) return explicitTenantId;

    const session = await getServerSession();
    if (!session) return null;

    const organizations = await fetchOrganizations(session.accessToken);
    return organizations[0]?.tenantId ?? null;
});

/**
 * The caller's memberships, fetched with the low-level transport.
 *
 * Deliberately NOT `serverFetch`: this runs *inside* default-tenant resolution,
 * so going through `serverFetch` again would recurse.
 */
async function fetchOrganizations(
    accessToken: string,
): Promise<OrganizationMembershipResponse[]> {
    try {
        const response = await fetch(
            `${selfOrigin()}${API_BASE}/users/me/organizations`,
            {
                headers: { Authorization: `Bearer ${accessToken}` },
                cache: "no-store",
            },
        );

        if (!response.ok) return [];

        return (await response.json()) as OrganizationMembershipResponse[];
    } catch {
        // No tenant to scope to — the caller falls back to a tenant-less request.
        return [];
    }
}

export interface ServerFetchOptions {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    /**
     * Tenant scope. Defaults to the caller's active tenant — the cookie while it
     * still names one of their memberships, otherwise the first one; pass `null`
     * explicitly for user-level endpoints (tenant discovery, /auth/me).
     */
    tenantId?: string | null;
    /**
     * Next.js cache directive. Defaults to no-store (per-user data).
     *
     * Typed as a literal union rather than the DOM's `RequestCache`, which the
     * lint config does not see as a global type.
     */
    cache?: "default" | "no-store" | "reload" | "no-cache" | "force-cache" | "only-if-cached";
    /** Set for data that is the same for everyone (rare in this app). */
    revalidate?: number;
}

export type ServerResult<T> =
    | { data: T; error: null }
    | { data: null; error: string };

/**
 * Call the API from the server.
 *
 * The tenant is taken from the cookie, never from a caller-supplied value that
 * originates in the browser — the API re-authorises it regardless, but keeping it
 * server-side means a page cannot be coaxed into requesting another tenant's
 * scope.
 */
export async function serverFetch<T>(
    path: string,
    options: ServerFetchOptions = {},
): Promise<ServerResult<T>> {
    const session = await getServerSession();

    if (!session) {
        return { data: null, error: "Not authenticated" };
    }

    const tenantId =
        options.tenantId === undefined
            ? await resolveActiveTenantId()
            : options.tenantId;

    const headers: Record<string, string> = {
        Authorization: `Bearer ${session.accessToken}`,
        "Content-Type": "application/json",
    };

    if (tenantId) {
        headers["X-Tenant-Id"] = tenantId;
    }

    try {
        const response = await fetch(`${selfOrigin()}${API_BASE}${path}`, {
            method: options.method ?? "GET",
            headers,
            body: options.body ? JSON.stringify(options.body) : undefined,
            cache: options.cache ?? "no-store",
            ...(options.revalidate !== undefined
                ? { next: { revalidate: options.revalidate } }
                : {}),
        });

        if (!response.ok) {
            return { data: null, error: await readError(response) };
        }

        const text = await response.text();
        return { data: (text ? JSON.parse(text) : null) as T, error: null };
    } catch (error) {
        // Network failure: surface it as data, not a thrown render error.
        return {
            data: null,
            error: error instanceof Error ? error.message : "Request failed",
        };
    }
}

/** Extract the API's error message, falling back to the status text. */
async function readError(response: Response): Promise<string> {
    try {
        const body = await response.json();
        return (
            body?.error?.message ??
            body?.message ??
            `HTTP ${response.status}`
        );
    } catch {
        return `HTTP ${response.status} ${response.statusText}`;
    }
}

/**
 * Like `serverFetch`, but throws when unauthenticated or on failure.
 *
 * For data a page cannot render without (the user, the tenant list). Callers
 * are expected to have already checked the session via `requireSession()`.
 */
export async function serverFetchOrThrow<T>(
    path: string,
    options: ServerFetchOptions = {},
): Promise<T> {
    const result = await serverFetch<T>(path, options);

    if (result.error !== null) {
        throw new Error(result.error);
    }

    return result.data;
}

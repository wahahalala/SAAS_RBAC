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

export interface ServerFetchOptions {
    method?: "GET" | "POST" | "PATCH" | "DELETE";
    body?: unknown;
    /**
     * Tenant scope. Defaults to the caller's active tenant cookie; pass `null`
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
            ? await getActiveTenantId()
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

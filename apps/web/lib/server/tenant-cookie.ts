import { cookies } from "next/headers";

/**
 * Active tenant, stored as a cookie.
 *
 * It moved here from localStorage because Server Components must scope their
 * data fetches by tenant, and only a cookie is readable on the server. The
 * value is not a secret — it is the same id the API returns in
 * `GET /users/me/organizations`, and the API re-authorises it against the
 * caller's Membership on every request, so a tampered value is simply a 403.
 *
 * Security flags are deliberately omitted for the same reason the value is not
 * secret; keeping it readable from JS lets the client switch tenants without a
 * round trip.
 */
export const ACTIVE_TENANT_COOKIE = "saas.activeTenantId";

/** One year: the tenant choice should outlive a session, like a preference. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Read the active tenant on the SERVER (Server Components, Server Actions,
 * Route Handlers).
 */
export async function getActiveTenantId(): Promise<string | null> {
    const store = await cookies();
    return store.get(ACTIVE_TENANT_COOKIE)?.value ?? null;
}

/**
 * Set or clear the active tenant.
 *
 * Only callable from a Server Action or Route Handler: Server Components cannot
 * mutate cookies.
 */
export async function setActiveTenantCookie(
    tenantId: string | null,
): Promise<void> {
    const store = await cookies();

    if (!tenantId) {
        store.delete(ACTIVE_TENANT_COOKIE);
        return;
    }

    store.set(ACTIVE_TENANT_COOKIE, tenantId, {
        path: "/",
        maxAge: MAX_AGE_SECONDS,
        sameSite: "lax",
    });
}

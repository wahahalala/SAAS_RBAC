/**
 * Active tenant storage.
 *
 * The "active tenant" is the tenant whose scope every tenant-bound API request
 * is sent in, via the `X-Tenant-Id` header. It is NOT a secret: it is the same
 * id the API returns in `GET /users/me/organizations` (always authorised
 * against the user's Membership server-side), so persisting it in
 * localStorage is safe — a tampered value is simply rejected with 403.
 *
 * The access/refresh tokens are deliberately NOT stored here (see
 * lib/auth-tokens.ts and lib/stores/auth-store.ts).
 */
const STORAGE_KEY = "saas.activeTenantId";

let activeTenantId: string | null = null;
let hydrated = false;

function readFromStorage(): string | null {
    if (typeof window === "undefined") return null;
    try {
        return window.localStorage.getItem(STORAGE_KEY);
    } catch {
        // localStorage can throw in private mode / blocked storage.
        return null;
    }
}

/** Rehydrate from localStorage once, on first client-side access. */
function ensureHydrated(): void {
    if (hydrated) return;
    hydrated = true;
    activeTenantId = readFromStorage();
}

export function getActiveTenantId(): string | null {
    ensureHydrated();
    return activeTenantId;
}

export function setActiveTenantId(tenantId: string | null): void {
    ensureHydrated();
    activeTenantId = tenantId;

    if (typeof window === "undefined") return;
    try {
        if (tenantId) {
            window.localStorage.setItem(STORAGE_KEY, tenantId);
        } else {
            window.localStorage.removeItem(STORAGE_KEY);
        }
    } catch {
        // Ignore storage failures: the in-memory value still works.
    }
}

export function clearActiveTenantId(): void {
    setActiveTenantId(null);
}

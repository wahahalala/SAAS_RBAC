/**
 * In-memory access token storage.
 *
 * The access token is short-lived and kept ONLY in module memory — it is
 * never written to localStorage. On a full page reload the app simply
 * refreshes from the httpOnly refresh cookie via /auth/refresh.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
    accessToken = token;
}

export function getAccessToken(): string | null {
    return accessToken;
}

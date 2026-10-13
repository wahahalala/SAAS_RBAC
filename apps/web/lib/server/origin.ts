/**
 * Origin of this Next.js app, for server-side fetches.
 *
 * Server-side `fetch` cannot resolve relative URLs, and calling the API through
 * this origin (rather than the API's own origin) is what applies the `/api/v1`
 * rewrite — which is what keeps the refresh cookie on the web host.
 */
/**
 * Upstream API origin.
 *
 * Shared with next.config.ts, which also proxies this origin — keep the two in
 * step so the rewrite and the auth handler never disagree.
 */
export const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

export function selfOrigin(): string {
    return (
        process.env.NEXT_PUBLIC_SITE_URL ??
        `http://localhost:${process.env.PORT ?? 3000}`
    );
}

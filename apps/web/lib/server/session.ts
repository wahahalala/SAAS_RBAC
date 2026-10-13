import { cookies } from "next/headers";
import type { AuthResponse, UserResponse } from "@saas/shared-types";
import { selfOrigin } from "./origin";

/**
 * Server-side session access.
 *
 * The API's refresh token is an httpOnly cookie on THIS origin, re-homed to
 * `Path=/` by the `/api/auth` proxy handler — which means server rendering can
 * authenticate without any client-side JS running first. That is the whole point of the refactor:
 * a Server Component can fetch data on the first paint instead of rendering a
 * loading state and waiting for a browser request.
 *
 * Access tokens are never stored server-side — they are short-lived, so the
 * server asks for a fresh one per request by spending the refresh cookie. The
 * API rotates the refresh token on each call, so the new cookie it returns has
 * to be written back.
 */

export interface ServerSession {
    accessToken: string;
    user: AuthResponse["user"];
}

/**
 * Exchange the refresh cookie for an access token.
 *
 * Returns null when there is no session (no cookie, or the API rejected it) —
 * callers treat that as "not signed in" rather than an error, because that is
 * the normal state for a first-time visitor.
 */
export async function getServerSession(): Promise<ServerSession | null> {
    const cookieStore = await cookies();
    const refreshToken = cookieStore.get("refresh_token")?.value;

    if (!refreshToken) return null;

    try {
        // `/session` mints an access token WITHOUT rotating the refresh token.
        // `/refresh` cannot be used here: it rotates, and a Server Component
        // cannot persist the new cookie, so the rotated token would be dropped
        // and the next render would present a revoked one.
        const response = await fetch(`${selfOrigin()}/api/auth/session`, {
            method: "POST",
            headers: {
                // Forward the refresh token explicitly: a server-side fetch does
                // not automatically carry the incoming request's cookies.
                cookie: `refresh_token=${refreshToken}`,
            },
            cache: "no-store",
        });

        if (!response.ok) return null;

        const auth = (await response.json()) as AuthResponse;
        if (!auth?.accessToken) return null;

        return { accessToken: auth.accessToken, user: auth.user };
    } catch {
        // An unreachable API is not a credential problem; treat as no session
        // so the page can still render its signed-out state.
        return null;
    }
}



/**
 * The signed-in user, or null.
 *
 * Permissions are intentionally NOT fetched here: they are tenant-scoped, and
 * most pages do not need them.
 */
export async function getServerUser(): Promise<UserResponse | null> {
    const session = await getServerSession();
    if (!session) return null;

    return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        emailVerified: session.user.emailVerified,
        createdAt: new Date().toISOString(),
    };
}

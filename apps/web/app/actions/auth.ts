"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
    loginSchema,
    registerSchema,
    type LoginInput,
    type RegisterInput,
} from "@saas/validation";
import type { AuthResponse } from "@saas/shared-types";
import { setActiveTenantCookie } from "@/lib/server/tenant-cookie";
import { selfOrigin } from "@/lib/server/origin";

/**
 * Authentication Server Actions.
 *
 * Mutations run on the server, so the access token never has to be held or
 * forwarded by client JavaScript. The refresh token arrives as an httpOnly
 * cookie (same origin, via the `/api/auth` proxy handler, which also widens its
 * Path to "/" so page renders can read it) and is forwarded to the browser.
 *
 * Actions return a result object instead of throwing: a thrown error inside an
 * action surfaces as an opaque "something went wrong", whereas a returned
 * `{ error }` lets the form render the API's actual message next to the field.
 */

export interface AuthActionResult {
    error: string | null;
    /** Set on success: where the client should navigate. */
    redirectTo?: string;
}

/** Path to return to, validated so `?redirect=` cannot become an open redirect. */
function safeRedirectTarget(redirectTo: string | undefined): string {
    if (!redirectTo) return "/dashboard";
    // Single-slash absolute paths only: rejects "//evil.com" and "https://evil.com".
    if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
        return "/dashboard";
    }
    return redirectTo;
}

/**
 * Forward the API's `Set-Cookie` for the refresh token.
 *
 * The action calls the API itself (rather than having the browser call it), so
 * the cookie must be re-set on the browser-facing response explicitly.
 */
async function adoptRefreshCookie(response: Response): Promise<void> {
    const setCookie = response.headers.get("set-cookie");
    if (!setCookie) return;

    const match = /refresh_token=([^;]*)/.exec(setCookie);
    const token = match?.[1];
    if (!token) return;

    const store = await cookies();
    store.set("refresh_token", token, {
        // Path "/" on purpose. The API sets this cookie at "/api/v1/auth", but
        // that path means the browser only sends it on those requests — and a
        // Server Component rendering /dashboard would never see it, making every
        // protected page look signed out. Re-homing it to the whole origin is
        // what makes server-side rendering able to authenticate.
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7,
    });
}

async function postJson(
    path: string,
    body: unknown,
    cookieHeader?: string,
): Promise<Response> {
    // Auth goes through the proxy handler, which re-homes the refresh cookie to
    // Path=/ so server rendering can read it.
    return fetch(`${selfOrigin()}/api/auth${path}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            ...(cookieHeader ? { cookie: cookieHeader } : {}),
        },
        body: JSON.stringify(body),
        cache: "no-store",
    });
}

async function readErrorMessage(response: Response): Promise<string> {
    try {
        const body = await response.json();
        return (
            body?.error?.message ?? body?.message ?? "Something went wrong"
        );
    } catch {
        return `HTTP ${response.status}`;
    }
}

/**
 * Sign in.
 *
 * On success the tenant cookie is cleared: the previous tenant may belong to a
 * different account, and `getTenantContext` will re-resolve it from the new
 * user's memberships.
 */
export async function loginAction(
    input: LoginInput & { redirectTo?: string },
): Promise<AuthActionResult> {
    const parsed = loginSchema.safeParse(input);

    if (!parsed.success) {
        return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
    }

    let response: Response;
    try {
        response = await postJson("/login", parsed.data);
    } catch {
        return { error: "Could not reach the server" };
    }

    if (!response.ok) {
        return { error: await readErrorMessage(response) };
    }

    await adoptRefreshCookie(response);
    // A different account owns a different set of tenants.
    await setActiveTenantCookie(null);

    revalidatePath("/", "layout");
    return { error: null, redirectTo: safeRedirectTarget(input.redirectTo) };
}

export async function registerAction(
    input: RegisterInput & { redirectTo?: string },
): Promise<AuthActionResult> {
    const parsed = registerSchema.safeParse(input);

    if (!parsed.success) {
        return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
    }

    let response: Response;
    try {
        response = await postJson("/register", parsed.data);
    } catch {
        return { error: "Could not reach the server" };
    }

    if (!response.ok) {
        return { error: await readErrorMessage(response) };
    }

    await adoptRefreshCookie(response);
    await setActiveTenantCookie(null);

    revalidatePath("/", "layout");
    return { error: null, redirectTo: safeRedirectTarget(input.redirectTo) };
}

/**
 * Sign out the current device.
 *
 * The API needs the refresh cookie to know which session to revoke, so it is
 * forwarded from this request's cookies.
 */
export async function logoutAction(): Promise<AuthActionResult> {
    const store = await cookies();
    const refreshToken = store.get("refresh_token")?.value;

    try {
        await postJson(
            "/logout",
            {},
            refreshToken ? `refresh_token=${refreshToken}` : undefined,
        );
    } catch {
        // A failed server-side logout must not trap the user in a signed-in UI:
        // clearing the cookie locally still ends the session for this browser.
    }

    store.delete("refresh_token");
    await setActiveTenantCookie(null);

    revalidatePath("/", "layout");
    return { error: null, redirectTo: "/login" };
}

/** Sign out every device. */
export async function logoutAllAction(): Promise<AuthActionResult> {
    const store = await cookies();
    const refreshToken = store.get("refresh_token")?.value;

    // This endpoint is authenticated, so it needs a fresh access token.
    const refreshed = refreshToken
        ? await postJson("/refresh", {}, `refresh_token=${refreshToken}`)
        : null;

    if (refreshed?.ok) {
        const auth = (await refreshed.json()) as AuthResponse;
        try {
            await fetch(`${selfOrigin()}/api/auth/logout-all`, {
                method: "POST",
                headers: { Authorization: `Bearer ${auth.accessToken}` },
                cache: "no-store",
            });
        } catch {
            // Same reasoning as logoutAction.
        }
    }

    store.delete("refresh_token");
    await setActiveTenantCookie(null);

    revalidatePath("/", "layout");
    return { error: null, redirectTo: "/login" };
}

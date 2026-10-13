import { NextRequest, NextResponse } from "next/server";
import { API_ORIGIN } from "@/lib/server/origin";

/**
 * Auth proxy — mounted at `/api/auth/*`, NOT under the `/api/v1` rewrite.
 *
 * Two jobs:
 *
 *  1. Forward authentication calls to the API.
 *  2. REWRITE the refresh cookie's Path from `/api/v1/auth` to `/`.
 *
 * The second job is why this is a Route Handler rather than a plain rewrite. The
 * API scopes `refresh_token` to `/api/v1/auth`, meaning the browser only sends it
 * on those requests — so a Server Component rendering `/dashboard` would never
 * see it, and server-side authentication would be impossible. Widening the path
 * here (instead of editing the API, which other clients may call directly) keeps
 * the API's contract intact. The cookie remains httpOnly + SameSite=Lax; only its
 * scope changes.
 *
 * Dynamic: credentials and cookies are involved, so nothing here may be cached.
 */
export const dynamic = "force-dynamic";

async function forward(request: NextRequest, path: string[]) {
    const target = `${API_ORIGIN}/api/v1/auth/${path.join("/")}${request.nextUrl.search}`;

    const headers = new Headers(request.headers);
    // Hop-by-hop headers must not be forwarded upstream.
    headers.delete("host");
    headers.delete("connection");
    headers.delete("content-length");

    let upstream: Response;
    try {
        upstream = await fetch(target, {
            method: request.method,
            headers,
            body:
                request.method === "GET" || request.method === "HEAD"
                    ? undefined
                    : await request.arrayBuffer(),
            redirect: "manual",
            cache: "no-store",
        });
    } catch {
        return NextResponse.json(
            { error: "Could not reach the authentication service" },
            { status: 502 },
        );
    }

    const response = new NextResponse(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
    });

    upstream.headers.forEach((value, key) => {
        if (key.toLowerCase() === "set-cookie") return;
        response.headers.set(key, value);
    });

    for (const cookie of upstream.headers.getSetCookie()) {
        response.headers.append("set-cookie", rehomeRefreshCookie(cookie));
    }

    return response;
}

/**
 * Move the refresh cookie to the whole origin.
 *
 * Path is stripped rather than replaced so any other attribute the API sets
 * (Max-Age, Secure, SameSite) survives untouched.
 */
function rehomeRefreshCookie(setCookie: string): string {
    if (!setCookie.startsWith("refresh_token=")) return setCookie;

    const withoutPath = setCookie.replace(/;\s*Path=[^;]*/gi, "");
    return `${withoutPath}; Path=/`;
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> },
) {
    const { path } = await context.params;
    return forward(request, path);
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ path: string[] }> },
) {
    const { path } = await context.params;
    return forward(request, path);
}

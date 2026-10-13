import { NextResponse } from "next/server";

/**
 * Liveness probe for the web app.
 *
 * Nginx and the container healthcheck hit this instead of a real page: it costs
 * no session resolution, no route compilation, and cannot redirect (a probe
 * following /dashboard to /login would be invisible as an error state).
 */
export const dynamic = "force-dynamic";

export function GET() {
    return NextResponse.json({ status: "ok" }, { status: 200 });
}

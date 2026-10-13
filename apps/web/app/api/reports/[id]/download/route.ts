import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/session";
import { getActiveTenantId } from "@/lib/server/tenant-cookie";
import { selfOrigin } from "@/lib/server/origin";

/**
 * BFF: stream a report download.
 *
 * Why a Route Handler instead of a Server Action: the browser needs the bytes as
 * a file, and the API endpoint is authenticated. Proxying through this handler
 * keeps the access token server-side — a plain `<a href>` to the API could not
 * carry a Bearer token, and putting one in a query string would leak it into
 * browser history and server logs.
 *
 * Dynamic on purpose: it reads cookies and forwards credentials.
 */
export const dynamic = "force-dynamic";

export async function GET(
    _request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    const { id } = await context.params;

    const session = await getServerSession();
    if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const tenantId = await getActiveTenantId();
    if (!tenantId) {
        return NextResponse.json(
            { error: "No active organization" },
            { status: 403 },
        );
    }

    let upstream: Response;
    try {
        upstream = await fetch(`${selfOrigin()}/api/v1/reports/${id}/download`, {
            headers: {
                Authorization: `Bearer ${session.accessToken}`,
                "X-Tenant-Id": tenantId,
            },
            cache: "no-store",
        });
    } catch {
        return NextResponse.json(
            { error: "Could not reach the API" },
            { status: 502 },
        );
    }

    if (!upstream.ok || !upstream.body) {
        // Pass the API's status through (409 "not ready", 404 unknown) so the
        // client can tell the cases apart.
        return NextResponse.json(
            { error: upstream.statusText || "Download failed" },
            { status: upstream.status || 502 },
        );
    }

    // Forward the download headers so the browser saves the real filename.
    const headers = new Headers();
    for (const name of [
        "content-type",
        "content-disposition",
        "content-length",
    ]) {
        const value = upstream.headers.get(name);
        if (value) headers.set(name, value);
    }

    return new NextResponse(upstream.body, { status: 200, headers });
}

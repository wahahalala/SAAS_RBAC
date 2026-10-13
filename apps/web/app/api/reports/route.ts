import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/server/session";
import { getActiveTenantId } from "@/lib/server/tenant-cookie";
import { serverFetch } from "@/lib/server/api";

/**
 * BFF: report list for CLIENT-SIDE polling.
 *
 * Report generation is asynchronous, so the client needs to poll for status
 * changes — that is the one place TanStack Query is still the right tool (it
 * owns "server state on the client"). The handler keeps the access token on the
 * server: the browser calls this same-origin endpoint, which carries the
 * credentials instead.
 */
export const dynamic = "force-dynamic";

export async function GET() {
    const session = await getServerSession();
    if (!session) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const tenantId = await getActiveTenantId();
    if (!tenantId) {
        return NextResponse.json({ items: [] }, { status: 200 });
    }

    const result = await serverFetch<unknown[]>("/reports");

    if (result.error !== null) {
        return NextResponse.json({ error: result.error }, { status: 502 });
    }

    return NextResponse.json(result.data);
}

/**
 * BFF: request a new report.
 *
 * A mutation, so it could be a Server Action — it is a Route Handler here because
 * the reports panel polls the list with TanStack Query and invalidates that cache
 * on success, which needs a fetch-shaped call rather than a form action.
 */
export async function POST(request: Request) {
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

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await serverFetch("/reports", { method: "POST", body });

    if (result.error !== null) {
        return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json(result.data, { status: 201 });
}

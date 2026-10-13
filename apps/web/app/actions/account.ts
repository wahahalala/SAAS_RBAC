"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { serverFetch } from "@/lib/server/api";
import { setActiveTenantCookie } from "@/lib/server/tenant-cookie";
import type { ActionResult } from "./tenant";

/**
 * Account deletion.
 *
 * Irreversible, so it is a Server Action: the request is authenticated
 * server-side, and the session cookies are cleared on the server afterwards. A
 * client-side call could leave a stale cookie behind if the tab closed mid-flight.
 */
export async function deleteAccountAction(): Promise<ActionResult> {
    const result = await serverFetch("/users/me", {
        method: "DELETE",
        // User-level endpoint: not tenant-scoped.
        tenantId: null,
    });

    if (result.error !== null) {
        return { error: result.error };
    }

    const store = await cookies();
    store.delete("refresh_token");
    await setActiveTenantCookie(null);

    revalidatePath("/", "layout");
    return { error: null, redirectTo: "/login" };
}

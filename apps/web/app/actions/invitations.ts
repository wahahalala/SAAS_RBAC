"use server";

import { revalidatePath } from "next/cache";
import { selfOrigin } from "@/lib/server/origin";
import { getServerSession } from "@/lib/server/session";

/**
 * Accept an invitation.
 *
 * A Server Action: acceptance creates a Membership, which changes the caller's
 * tenant list — so the mutation and the revalidation belong on the server, and
 * the redirect to the new organization happens without the client handling a
 * token.
 *
 * The token is the credential here (per the invitation design), so this action
 * does not need the caller's email to match the invited address.
 */
export async function acceptInvitationAction(
    token: string,
): Promise<{ error: string | null; redirectTo?: string }> {
    const session = await getServerSession();

    if (!session) {
        // Send them to sign in and come back to the same invitation.
        return {
            error: null,
            redirectTo: `/login?redirect=${encodeURIComponent(`/invitations/${token}`)}`,
        };
    }

    let response: Response;
    try {
        response = await fetch(
            `${selfOrigin()}/api/v1/invitations/${token}/accept`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.accessToken}`,
                },
                cache: "no-store",
            },
        );
    } catch {
        return { error: "Could not reach the server" };
    }

    if (!response.ok) {
        try {
            const body = await response.json();
            return {
                error: body?.error?.message ?? body?.message ?? "Could not accept",
            };
        } catch {
            return { error: `HTTP ${response.status}` };
        }
    }

    const result = (await response.json()) as { organizationSlug?: string };

    // The membership is new, so the dashboard shell's tenant list is stale.
    revalidatePath("/dashboard", "layout");

    return {
        error: null,
        redirectTo: result.organizationSlug
            ? `/dashboard?joined=${encodeURIComponent(result.organizationSlug)}`
            : "/dashboard",
    };
}

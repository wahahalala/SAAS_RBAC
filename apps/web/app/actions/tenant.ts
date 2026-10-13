"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
    inviteMemberSchema,
    updateOrganizationSchema,
    updateProfileSchema,
    type InviteMemberInput,
    type UpdateOrganizationInput,
    type UpdateProfileInput,
} from "@saas/validation";
import { serverFetch } from "@/lib/server/api";
import {
    getActiveTenantId,
    setActiveTenantCookie,
} from "@/lib/server/tenant-cookie";
import { getTenantContext } from "@/lib/server/tenant";

/**
 * Tenant, member and profile mutations as Server Actions.
 *
 * These run on the server, so the API call carries the access token server-side
 * and the client never sees it. Each action revalidates the paths whose data it
 * changed, which is what makes the Server Components re-render with fresh data
 * without any client-side cache bookkeeping.
 */

export interface ActionResult<T = undefined> {
    error: string | null;
    data?: T;
    /** Set on success: where the caller should navigate. */
    redirectTo?: string;
}

const createOrganizationSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    slug: z
        .string()
        .min(2, "Slug must be at least 2 characters")
        .regex(/^[a-z0-9-]+$/, "Only lowercase letters, numbers, and hyphens")
        .optional()
        .or(z.literal("")),
});

/**
 * Switch the active tenant.
 *
 * A cookie write plus a revalidation — deliberately not a client-side store
 * update, because every tenant-scoped fetch happens on the server and must see
 * the new value. The tenant is verified against the caller's memberships first,
 * so a forged value cannot scope the UI to someone else's data.
 */
export async function switchTenantAction(
    tenantId: string,
): Promise<ActionResult> {
    const { organizations } = await getTenantContext();

    const belongs = organizations.some((org) => org.tenantId === tenantId);
    if (!belongs) {
        return { error: "You are not a member of that organization" };
    }

    await setActiveTenantCookie(tenantId);

    // Every tenant-scoped page is now stale.
    revalidatePath("/dashboard", "layout");

    return { error: null };
}

export async function createOrganizationAction(
    input: { name: string; slug?: string },
): Promise<ActionResult<{ slug: string }>> {
    const parsed = createOrganizationSchema.safeParse(input);

    if (!parsed.success) {
        return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
    }

    const body = {
        name: parsed.data.name,
        ...(parsed.data.slug ? { slug: parsed.data.slug } : {}),
    };

    // Provisioning is not tenant-scoped: there is no tenant yet.
    const result = await serverFetch<{ tenantId: string; slug: string }>(
        "/organizations",
        { method: "POST", body, tenantId: null },
    );

    if (result.error !== null) {
        return { error: result.error };
    }

    // Make the organization they just created the active one.
    await setActiveTenantCookie(result.data.tenantId);
    revalidatePath("/dashboard", "layout");

    return { error: null, data: { slug: result.data.slug } };
}

export async function updateOrganizationAction(
    input: UpdateOrganizationInput,
): Promise<ActionResult> {
    const parsed = updateOrganizationSchema.safeParse(input);

    if (!parsed.success) {
        return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
    }

    const tenantId = await getActiveTenantId();
    if (!tenantId) return { error: "No active organization" };

    const { organizations } = await getTenantContext();
    const active = organizations.find((org) => org.tenantId === tenantId);
    if (!active) return { error: "No active organization" };

    const result = await serverFetch(`/organizations/${active.slug}`, {
        method: "PATCH",
        body: parsed.data,
    });

    if (result.error !== null) return { error: result.error };

    revalidatePath("/dashboard/organization");
    revalidatePath("/dashboard", "layout");

    return { error: null };
}

export async function inviteMemberAction(
    input: InviteMemberInput,
): Promise<ActionResult> {
    const parsed = inviteMemberSchema.safeParse(input);

    if (!parsed.success) {
        return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
    }

    const { activeOrganization } = await requireActiveOrganizationSlug();

    const result = await serverFetch(
        `/organizations/${activeOrganization}/invitations`,
        { method: "POST", body: parsed.data },
    );

    if (result.error !== null) return { error: result.error };

    revalidatePath("/dashboard/team");
    return { error: null };
}

/**
 * REVOKE an invitation.
 *
 * The route takes the invitation id, which the API validates against the
 * caller's tenant.
 */
export async function revokeInvitationAction(
    invitationId: string,
): Promise<ActionResult> {
    const { activeOrganization } = await requireActiveOrganizationSlug();

    const result = await serverFetch(
        `/organizations/${activeOrganization}/invitations/${invitationId}`,
        { method: "DELETE" },
    );

    if (result.error !== null) return { error: result.error };

    revalidatePath("/dashboard/team");
    return { error: null };
}

export async function updateMemberRoleAction(
    memberId: string,
    role: "admin" | "member",
): Promise<ActionResult> {
    const { activeOrganization } = await requireActiveOrganizationSlug();

    const result = await serverFetch(
        `/organizations/${activeOrganization}/members/${memberId}`,
        { method: "PATCH", body: { role } },
    );

    if (result.error !== null) return { error: result.error };

    revalidatePath("/dashboard/team");
    return { error: null };
}

export async function removeMemberAction(
    memberId: string,
): Promise<ActionResult> {
    const { activeOrganization } = await requireActiveOrganizationSlug();

    const result = await serverFetch(
        `/organizations/${activeOrganization}/members/${memberId}`,
        { method: "DELETE" },
    );

    if (result.error !== null) return { error: result.error };

    revalidatePath("/dashboard/team");
    return { error: null };
}

export async function updateProfileAction(
    input: UpdateProfileInput,
): Promise<ActionResult> {
    const parsed = updateProfileSchema.safeParse(input);

    if (!parsed.success) {
        return { error: parsed.error.errors[0]?.message ?? "Invalid input" };
    }

    // User-level endpoint: no tenant scope.
    const result = await serverFetch("/users/me", {
        method: "PATCH",
        body: parsed.data,
        tenantId: null,
    });

    if (result.error !== null) return { error: result.error };

    revalidatePath("/dashboard/settings");
    revalidatePath("/dashboard", "layout");

    return { error: null };
}

export async function revokeSessionAction(
    sessionId: string,
): Promise<ActionResult> {
    const result = await serverFetch(`/auth/sessions/${sessionId}`, {
        method: "DELETE",
        tenantId: null,
    });

    if (result.error !== null) return { error: result.error };

    revalidatePath("/dashboard/settings");
    return { error: null };
}

/**
 * The active organization's slug, resolved server-side.
 *
 * Routes address organizations by slug, and resolving it here (rather than
 * trusting a client-supplied value) keeps the tenant binding on the server.
 */
async function requireActiveOrganizationSlug() {
    const { activeOrganization } = await getTenantContext();

    if (!activeOrganization) {
        throw new Error("No active organization");
    }

    return { activeOrganization: activeOrganization.slug };
}

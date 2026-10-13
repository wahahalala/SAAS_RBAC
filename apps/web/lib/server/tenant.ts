import { redirect } from "next/navigation";
import type {
    OrganizationMembershipResponse,
    UserResponse,
} from "@saas/shared-types";
import { getActiveTenantId } from "./tenant-cookie";
import { getServerSession } from "./session";
import { serverFetch, serverFetchOrThrow, resolveActiveTenantId } from "./api";

/**
 * Server-side tenant context for Server Components.
 *
 * Every dashboard page needs the same three things: the signed-in user, the
 * tenants they belong to, and which of those is active. Resolving them here
 * keeps pages from repeating the logic — and from disagreeing about it, which is
 * what the old client-side hooks risked when each one read localStorage
 * independently.
 */

export interface ServerTenantContext {
    user: UserResponse;
    organizations: OrganizationMembershipResponse[];
    activeTenantId: string | null;
    activeOrganization: OrganizationMembershipResponse | null;
}

/**
 * Resolve the session, redirecting to sign-in when there is none.
 *
 * A Server Component cannot render a "please log in" page for a protected route
 * without flashing content, so an unauthenticated request is redirected — the
 * browser never sees the dashboard shell at all.
 */
export async function requireSession(returnTo?: string) {
    const session = await getServerSession();

    if (!session) {
        const target = returnTo
            ? `/login?redirect=${encodeURIComponent(returnTo)}`
            : "/login";
        redirect(target);
    }

    return session;
}

/**
 * The full tenant context for the current request.
 *
 * The active tenant is reconciled rather than trusted: if the cookie names a
 * tenant the user no longer belongs to (removed, or a stale cookie from another
 * account), it falls back to the first membership so a page never renders an
 * empty dashboard because of a stale preference.
 */
export async function getTenantContext(
    returnTo?: string,
): Promise<ServerTenantContext> {
    const session = await requireSession(returnTo);

    const user: UserResponse = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        emailVerified: session.user.emailVerified,
        createdAt: new Date().toISOString(),
    };

    // User-level endpoint: no tenant scope, which is what makes discovery work.
    const organizations = await serverFetchOrThrow<
        OrganizationMembershipResponse[]
    >("/users/me/organizations", { tenantId: null });

    const cookieTenantId = await getActiveTenantId();

    const activeOrganization =
        organizations.find((org) => org.tenantId === cookieTenantId) ??
        organizations[0] ??
        null;

    return {
        user,
        organizations,
        activeTenantId: activeOrganization?.tenantId ?? null,
        activeOrganization,
    };
}

/**
 * Tenant context for pages that need an active tenant to be meaningful.
 *
 * Returns the context plus a guaranteed non-null active tenant, or an error the
 * page can render — a dashboard with no organization is a normal state for a new
 * account, not an exception.
 */
export async function getTenantContextOrError(returnTo?: string) {
    const context = await getTenantContext(returnTo);

    if (!context.activeTenantId) {
        return { ...context, activeOrganization: null, hasTenant: false as const };
    }

    return {
        ...context,
        activeOrganization: context.activeOrganization!,
        hasTenant: true as const,
    };
}

/** Permissions for the active tenant, for server-side gating of UI. */
export async function getServerPermissions(): Promise<Set<string>> {
    // Same reconciliation `getTenantContext` performs for display: the cookie
    // when it still names one of the caller's tenants, otherwise their first.
    // Reading the cookie alone returns an empty set right after login (the cookie
    // is cleared there), which would hide admin-only UI from an admin.
    const tenantId = await resolveActiveTenantId();
    if (!tenantId) return new Set();

    // Pass the resolved tenant explicitly so the permission query and the page's
    // data fetch cannot disagree about scope.
    const result = await serverFetch<{ permissions: string[] }>(
        "/auth/me/permissions",
        { tenantId },
    );

    return new Set(result.data?.permissions ?? []);
}

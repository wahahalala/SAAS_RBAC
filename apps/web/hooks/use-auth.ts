"use client";

import { useCallback, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { apiClient } from "@/lib/api-client";
import { setAccessToken } from "@/lib/auth-tokens";
import { getActiveTenantId } from "@/lib/tenant-tokens";
import { useAuthStore, useTenantStore, type User } from "@/lib/stores";
import type { AuthResponse } from "@saas/shared-types";

/**
 * React Query key segments whose data is scoped to a single tenant. When the
 * active tenant changes, these caches must be dropped so the UI cannot show
 * data fetched under the previous `X-Tenant-Id`.
 */
const TENANT_SCOPED_QUERY_KEYS = ["permissions", "members", "organization"];

export function useAuth(): {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    setUser: (user: User | null) => void;
} {
    const { user, isAuthenticated, isLoading, setUser } = useAuthStore();

    return {
        user,
        isAuthenticated,
        isLoading,
        setUser,
    };
}

/**
 * Restore the session on page load.
 *
 * The access token lives in memory only, so a full reload always starts
 * "logged out" from the store's perspective. We attempt one silent refresh
 * (httpOnly cookie) to recover the access token and user profile.
 */
export function useSessionBootstrap() {
    const { isAuthenticated, setUser, setLoading, setUnauthenticated } =
        useAuthStore();

    return useQuery({
        queryKey: ["session"],
        queryFn: async () => {
            try {
                const auth = await apiClient.refresh();
                if (auth) {
                    setAccessToken(auth.accessToken);
                    setUser(auth.user);
                    return auth;
                }
                setUnauthenticated();
            } catch {
                setUnauthenticated();
            } finally {
                setLoading(false);
            }
            return null;
        },
        // Only run once, never refetch, and only when not already authenticated.
        enabled: !isAuthenticated,
        staleTime: Infinity,
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: false,
    });
}

export function useLogin() {
    const { setUser } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { email: string; password: string }) =>
            apiClient.login(data),
        onSuccess: (data: AuthResponse) => {
            setAccessToken(data.accessToken);
            setUser(data.user);
            queryClient.invalidateQueries({ queryKey: ["user"] });
            router.push("/dashboard");
        },
    });
}

export function useRegister() {
    const { setUser } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: { email: string; password: string; name: string }) =>
            apiClient.register(data),
        onSuccess: (data: AuthResponse) => {
            setAccessToken(data.accessToken);
            setUser(data.user);
            queryClient.invalidateQueries({ queryKey: ["user"] });
            router.push("/dashboard");
        },
    });
}

export function useLogout() {
    const { setUnauthenticated } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();

    const clearSession = () => {
        setAccessToken(null);
        // Drop the persisted tenant: the next user must not inherit it.
        useTenantStore.getState().clearActiveTenant();
        setUnauthenticated();
        queryClient.clear();
        router.push("/login");
    };

    return useMutation({
        mutationFn: () => apiClient.logout(),
        onSuccess: clearSession,
        onError: () => {
            // Even if logout fails on server, clear local state.
            clearSession();
        },
    });
}

export function useLogoutAll() {
    const { setUnauthenticated } = useAuthStore();
    const router = useRouter();
    const queryClient = useQueryClient();

    const clearSession = () => {
        setAccessToken(null);
        useTenantStore.getState().clearActiveTenant();
        setUnauthenticated();
        queryClient.clear();
        router.push("/login");
    };

    return useMutation({
        mutationFn: () => apiClient.logoutAll(),
        onSuccess: clearSession,
        onError: clearSession,
    });
}

export function useUser() {
    const { isAuthenticated } = useAuthStore();

    return useQuery({
        queryKey: ["user"],
        queryFn: () => apiClient.getMe(),
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: false,
    });
}

export function useOrganizations() {
    const { isAuthenticated } = useAuthStore();

    return useQuery({
        queryKey: ["organizations"],
        queryFn: () => apiClient.getOrganizations(),
        enabled: isAuthenticated,
        staleTime: 2 * 60 * 1000, // 2 minutes
        retry: false,
    });
}

/**
 * The organization the dashboard pages operate on: the one backing the active
 * tenant, so the tenant shown in the switcher and the tenant sent in
 * `X-Tenant-Id` can never disagree (unlike a hard-coded "first organization").
 */
export function useCurrentOrganization() {
    const { activeOrganization, isLoading } = useActiveTenant();
    return { organization: activeOrganization, isLoading };
}

/**
 * Active tenant resolution.
 *
 * Every tenant-bound request carries `X-Tenant-Id`, so a tenant must be picked
 * as soon as the user's memberships are known. This hook reconciles the
 * persisted tenant (localStorage) against the memberships returned by the API:
 * keep it when still valid, otherwise fall back to the first organization.
 *
 * It also clears the selection on logout, and re-scopes tenant-bound caches
 * when the tenant changes so the UI never shows another tenant's data.
 */
export function useActiveTenant() {
    const { isAuthenticated } = useAuthStore();
    const activeTenantId = useTenantStore((s) => s.activeTenantId);
    const reconcileActiveTenant = useTenantStore(
        (s) => s.reconcileActiveTenant
    );
    const queryClient = useQueryClient();

    const { data: organizations, isLoading } = useOrganizations();

    const applyActiveTenant = useCallback(
        (tenantId: string | null) => {
            const previous = getActiveTenantId();
            if (previous === tenantId) return;

            // Drop tenant-scoped caches: they belong to the previous tenant.
            queryClient.removeQueries({
                predicate: (query) =>
                    TENANT_SCOPED_QUERY_KEYS.some((key) =>
                        query.queryKey.includes(key)
                    ),
            });

            useTenantStore.getState().setActiveTenantId(tenantId);
        },
        [queryClient]
    );

    const previousUserRef = useRef<string | null>(null);

    // Reconcile whenever the membership list changes (login + tenant switch).
    useEffect(() => {
        if (!isAuthenticated) {
            if (previousUserRef.current !== null || getActiveTenantId()) {
                applyActiveTenant(null);
            }
            previousUserRef.current = null;
            return;
        }

        if (!organizations) return;

        const next = reconcileActiveTenant(
            organizations.map((org) => org.tenantId)
        );
        if (next !== getActiveTenantId()) {
            applyActiveTenant(next);
        }
        previousUserRef.current = "ready";
    }, [isAuthenticated, organizations, applyActiveTenant, reconcileActiveTenant]);

    const activeOrganization =
        organizations?.find((org) => org.tenantId === activeTenantId) ?? null;

    return {
        activeTenantId,
        activeOrganization,
        organizations: organizations ?? [],
        isLoading: isLoading || (isAuthenticated && !activeTenantId),
        setActiveTenant: applyActiveTenant,
    };
}

export function useCreateOrganization() {
    const queryClient = useQueryClient();
    const router = useRouter();

    return useMutation({
        mutationFn: (data: { name: string; slug?: string }) =>
            apiClient.createOrganization(data),
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["organizations"] });
            router.push(`/dashboard/${data.slug}`);
        },
    });
}

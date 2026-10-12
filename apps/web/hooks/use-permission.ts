"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/lib/stores";

/**
 * Fetch the current user's effective permissions for the active tenant.
 */
export function usePermissions() {
    const { isAuthenticated } = useAuthStore();

    return useQuery({
        queryKey: ["permissions"],
        queryFn: () => apiClient.getMyPermissions(),
        enabled: isAuthenticated,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: false,
        select: (data) => new Set(data.permissions),
    });
}

/**
 * Check whether the current user holds any of the given permissions.
 *
 * @example
 * const { can } = usePermission();
 * {can("project.create") && <CreateButton />}
 *
 * @example
 * const { canAll } = usePermission();
 * {canAll(["billing.manage", "user.delete"]) && <DangerActions />}
 */
export function usePermission() {
    const { data: permissions } = usePermissions();

    const can = (...required: string[]) => {
        if (!permissions) return false;
        return required.some((p) => permissions.has(p));
    };

    const canAll = (required: string[]) => {
        if (!permissions) return false;
        return required.every((p) => permissions.has(p));
    };

    return { permissions, can, canAll };
}

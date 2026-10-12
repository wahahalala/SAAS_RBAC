import { create } from "zustand";
import { getActiveTenantId, setActiveTenantId } from "@/lib/tenant-tokens";

interface TenantState {
    /**
     * Tenant currently scoping every tenant-bound API request. Sent as the
     * `X-Tenant-Id` header (see lib/api-client.ts). Highlighting/selection UI
     * reads this; it is never used for authorisation decisions client-side.
     */
    activeTenantId: string | null;

    setActiveTenantId: (tenantId: string | null) => void;
    /** Validate the persisted tenant against the user's memberships. */
    reconcileActiveTenant: (availableTenantIds: string[]) => string | null;
    clearActiveTenant: () => void;
}

export const useTenantStore = create<TenantState>()((set) => ({
    // Hydrated lazily from localStorage so the first render matches the server.
    activeTenantId: null,

    setActiveTenantId: (tenantId) => {
        setActiveTenantId(tenantId);
        set({ activeTenantId: tenantId });
    },

    /**
     * Keep the active tenant consistent with the memberships the API just
     * returned: keep it when still valid, otherwise fall back to the first
     * available tenant (or none when the user has no memberships).
     */
    reconcileActiveTenant: (availableTenantIds) => {
        const available = availableTenantIds.filter(Boolean);
        const current = getActiveTenantId();

        const next =
            current && available.includes(current)
                ? current
                : (available[0] ?? null);

        setActiveTenantId(next);
        set({ activeTenantId: next });
        return next;
    },

    clearActiveTenant: () => {
        setActiveTenantId(null);
        set({ activeTenantId: null });
    },
}));

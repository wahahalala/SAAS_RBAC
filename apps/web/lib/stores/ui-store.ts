import { create } from "zustand";

/**
 * UI-only state.
 *
 * Zustand holds state that belongs to the BROWSER and nowhere else. Server data
 * (the user, tenants, members, reports) deliberately does not live here: it is
 * fetched by Server Components, so duplicating it in a client store would create
 * two sources of truth that drift apart — which is exactly what the previous
 * auth/tenant stores did.
 */

interface UiState {
    /** Billing page: which price cycle the user is comparing. */
    billingCycle: "monthly" | "yearly";
    setBillingCycle: (cycle: "monthly" | "yearly") => void;

    /** Sidebar collapse, kept here so it can be read outside the sidebar tree. */
    isSidebarCollapsed: boolean;
    toggleSidebar: () => void;
}

export const useUiStore = create<UiState>()((set) => ({
    billingCycle: "monthly",
    setBillingCycle: (billingCycle) => set({ billingCycle }),

    isSidebarCollapsed: false,
    toggleSidebar: () =>
        set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
}));

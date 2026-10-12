import { create } from "zustand";

/**
 * Client-side user profile. Exported so hooks that return it can name the type
 * (TS4058 in declaration-emitting projects).
 */
export interface User {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
}

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;

    // Actions
    setUser: (user: User | null) => void;
    setLoading: (loading: boolean) => void;
    setUnauthenticated: () => void;
}

/**
 * Client auth state.
 *
 * SECURITY: access/refresh tokens are NOT stored here (and must never be
 * written to localStorage). The access token lives in module memory
 * (see lib/auth-tokens.ts); the refresh token lives in an httpOnly cookie.
 */
export const useAuthStore = create<AuthState>()((set) => ({
    user: null,
    isAuthenticated: false,
    isLoading: true,

    setUser: (user) =>
        set({
            user,
            isAuthenticated: !!user,
            isLoading: false,
        }),

    setLoading: (loading) => set({ isLoading: loading }),

    setUnauthenticated: () =>
        set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
        }),
}));

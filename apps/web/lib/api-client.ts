import { useAuthStore } from "@/lib/stores";
import { getAccessToken, setAccessToken } from "@/lib/auth-tokens";
import { getActiveTenantId } from "@/lib/tenant-tokens";
import type {
    AuthResponse,
    UserResponse,
    OrganizationMembershipResponse,
    OrganizationResponse,
    MemberResponse,
    SessionsResponse,
    RegisterInput,
    LoginInput,
    UpdateUserInput,
    CreateOrganizationInput,
    InviteMemberInput,
    InvitationPreviewResponse,
    InvitationSummaryResponse,
    AcceptInvitationResponse,
} from "@saas/shared-types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

class ApiClient {
    private baseUrl: string;
    private refreshing: Promise<boolean> | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    /**
     * Build the request headers for a call.
     *
     * `tenantScoped` controls the `X-Tenant-Id` header: the API's TenantGuard
     * REQUIRES it on tenant-bound routes (and rejects the request with 403 when
     * it is missing), while user-level routes such as `GET /users/me` or
     * `GET /auth/me` are marked `@SkipTenantCheck()` and must not depend on a
     * tenant being selected yet — that is what makes tenant discovery possible.
     */
    private buildHeaders(
        tenantScoped: boolean,
        extra?: Record<string, string>,
        accessToken: string | null = getAccessToken(),
        tenantId: string | null = getActiveTenantId(),
    ): Record<string, string> {
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            ...(extra || {}),
        };

        if (accessToken) {
            headers["Authorization"] = `Bearer ${accessToken}`;
        }

        if (tenantScoped && tenantId) {
            headers["X-Tenant-Id"] = tenantId;
        }

        return headers;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit & { tenantScoped?: boolean } = {}
    ): Promise<T> {
        const { tenantScoped = true, ...init } = options;
        const extraHeaders = init.headers as Record<string, string> | undefined;

        // Resolve the tenant ONCE: if the user switches tenant while this
        // request is in flight, the 401 retry must not silently retarget the
        // call at the new tenant (and cache its response under the old one).
        const tenantId = tenantScoped ? getActiveTenantId() : null;
        let headers = this.buildHeaders(tenantScoped, extraHeaders, getAccessToken(), tenantId);

        // Always send cookies (httpOnly refresh token).
        const response = await fetch(`${this.baseUrl}${endpoint}`, {
            ...init,
            headers,
            credentials: "include",
        });

        // Handle 401 - Try to refresh token once.
        if (response.status === 401) {
            const refreshed = await this.refreshToken();
            if (refreshed) {
                // Rebuild so the fresh access token is used (same tenant).
                headers = this.buildHeaders(
                    tenantScoped,
                    extraHeaders,
                    getAccessToken(),
                    tenantId
                );
                const retryResponse = await fetch(`${this.baseUrl}${endpoint}`, {
                    ...init,
                    headers,
                    credentials: "include",
                });
                if (!retryResponse.ok) {
                    throw await this.handleError(retryResponse);
                }
                return retryResponse.json();
            }
        }

        if (!response.ok) {
            throw await this.handleError(response);
        }

        const text = await response.text();
        if (!text) {
            return {} as T;
        }

        return JSON.parse(text);
    }

    private async handleError(response: Response): Promise<Error> {
        try {
            const error = await response.json();
            return new Error(
                error.error?.message || error.message || "An error occurred"
            );
        } catch {
            return new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
    }

    private async refreshToken(): Promise<boolean> {
        // Prevent concurrent refresh storms.
        if (this.refreshing) {
            return this.refreshing;
        }

        this.refreshing = this.doRefresh();
        try {
            return await this.refreshing;
        } finally {
            this.refreshing = null;
        }
    }

    private async doRefresh(): Promise<boolean> {
        const { setUnauthenticated } = useAuthStore.getState();

        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            if (!response.ok) {
                setAccessToken(null);
                setUnauthenticated();
                return false;
            }

            const data = await response.json();
            setAccessToken(data.accessToken);
            return true;
        } catch {
            setAccessToken(null);
            setUnauthenticated();
            return false;
        }
    }

    // Auth endpoints
    async register(data: RegisterInput) {
        return this.request<AuthResponse>("/auth/register", {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    async login(data: LoginInput) {
        return this.request<AuthResponse>("/auth/login", {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    async logout() {
        return this.request("/auth/logout", {
            method: "POST",
            tenantScoped: false,
        });
    }

    async logoutAll() {
        return this.request<{ message: string }>("/auth/logout-all", {
            method: "POST",
            tenantScoped: false,
        });
    }

    /**
     * Public refresh: returns the new auth response (access token + user) or
     * null when the refresh cookie is missing/invalid.
     */
    async refresh(): Promise<AuthResponse | null> {
        try {
            const response = await fetch(`${this.baseUrl}/auth/refresh`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
            });

            if (!response.ok) {
                return null;
            }

            const data = await response.json();
            setAccessToken(data.accessToken);
            return data;
        } catch {
            return null;
        }
    }

    async getSessions() {
        return this.request<SessionsResponse>("/auth/sessions", {
            tenantScoped: false,
        });
    }

    async revokeSession(sessionId: string) {
        return this.request(`/auth/sessions/${sessionId}`, {
            method: "DELETE",
            tenantScoped: false,
        });
    }

    async getMe() {
        return this.request<UserResponse>("/auth/me", { tenantScoped: false });
    }

    /** Tenant-scoped: TenantGuard rejects the call without a valid X-Tenant-Id. */
    async getMyPermissions() {
        return this.request<{ permissions: string[] }>("/auth/me/permissions");
    }

    // User endpoints
    async updateProfile(data: UpdateUserInput) {
        return this.request("/users/me", {
            method: "PATCH",
            body: JSON.stringify(data),
            tenantScoped: false,
        });
    }

    /** The tenant-discovery endpoint: must work before a tenant is selected. */
    async getOrganizations() {
        return this.request<OrganizationMembershipResponse[]>(
            "/users/me/organizations",
            { tenantScoped: false }
        );
    }

    // Organization endpoints
    /** Provisioning endpoint: no tenant exists yet, so it is not tenant-scoped. */
    async createOrganization(data: CreateOrganizationInput) {
        return this.request<OrganizationResponse>("/organizations", {
            method: "POST",
            body: JSON.stringify(data),
            tenantScoped: false,
        });
    }

    async getOrganization(slug: string) {
        return this.request<OrganizationResponse>(`/organizations/${slug}`);
    }

    async getOrganizationMembers(slug: string) {
        return this.request<MemberResponse[]>(`/organizations/${slug}/members`);
    }

    async inviteMember(slug: string, data: InviteMemberInput) {
        return this.request(`/organizations/${slug}/invitations`, {
            method: "POST",
            body: JSON.stringify(data),
        });
    }

    async listInvitations(slug: string) {
        return this.request<InvitationSummaryResponse[]>(
            `/organizations/${slug}/invitations`
        );
    }

    async revokeInvitation(slug: string, invitationId: string) {
        return this.request(`/organizations/${slug}/invitations/${invitationId}`, {
            method: "DELETE",
        });
    }

    // Invitation accept flow.
    //
    // Both calls are `tenantScoped: false`: the token itself is the tenant
    // selector, and the accept page must work before the user has an active
    // tenant (a brand-new user has none yet).
    async getInvitation(token: string) {
        return this.request<InvitationPreviewResponse>(`/invitations/${token}`, {
            tenantScoped: false,
        });
    }

    async acceptInvitation(token: string) {
        return this.request<AcceptInvitationResponse>(
            `/invitations/${token}/accept`,
            { method: "POST", tenantScoped: false }
        );
    }
}

export const apiClient = new ApiClient(API_URL);

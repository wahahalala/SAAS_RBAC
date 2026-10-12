import { Role, Plan } from "../constants";

/**
 * Auth response returned by register / login / refresh.
 *
 * With the httpOnly-cookie refresh-token flow, `refreshToken` is NOT returned
 * in the JSON body for credentials login/register/refresh — it is set as a
 * cookie by the API. It remains optional for compatibility (e.g. OAuth
 * redirect flows before they are migrated).
 */
export interface AuthResponse {
    accessToken: string;
    refreshToken?: string;
    user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
        emailVerified: boolean;
    };
}

/**
 * A single active refresh session (session list endpoint).
 */
export interface RefreshSessionResponse {
    id: string;
    device: string | null;
    ipAddress: string | null;
    expiresAt: Date | string;
    createdAt: Date | string;
}

export interface SessionsResponse {
    sessions: RefreshSessionResponse[];
    total: number;
}

/**
 * Public user profile.
 */
export interface UserResponse {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
    createdAt: Date | string;
}

/**
 * Organization summary as exposed by the API.
 */
export interface OrganizationResponse {
    id: string;
    /** Tenant id — the value the client sends back as `X-Tenant-Id`. */
    tenantId: string;
    name: string;
    slug: string;
    logo: string | null;
    memberCount: number;
    plan: Plan | string;
    createdAt: Date | string;
}

/**
 * Organization membership summary (users/me/organizations).
 */
export interface OrganizationMembershipResponse {
    id: string;
    /**
     * Tenant id backing this organization. The web client uses it as the
     * `X-Tenant-Id` header value on every tenant-scoped request.
     */
    tenantId: string;
    name: string;
    slug: string;
    logo: string | null;
    role: Role | string;
    memberCount: number;
    plan: Plan | string;
}

/**
 * Organization member as exposed by the API.
 */
export interface MemberResponse {
    id: string;
    userId: string;
    role: Role | string;
    user: {
        id: string;
        email: string;
        name: string | null;
        image: string | null;
    };
    createdAt: Date | string;
}

/**
 * Invitation created by the API.
 */
export interface InvitationResponse {
    id: string;
    email: string;
    organizationId: string;
    role: Role;
    token: string;
    expiresAt: Date | string;
    invitedById: string;
    createdAt: Date | string;
}

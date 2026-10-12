import { Role, Plan, InvitationStatus } from "../constants";
import type {
    ReportTypeName,
    ReportFormatName,
    ReportStateName,
} from "../queue";

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

/**
 * An invitation as listed for administrators.
 *
 * Omits the token: listing invitations must not hand out accept links for
 * other people's invitations.
 */
export interface InvitationSummaryResponse {
    id: string;
    email: string;
    /** Effective status, with expiry already applied. */
    status: InvitationStatus;
    role: Role | string;
    expiresAt: Date | string;
    createdAt: Date | string;
    invitedBy: {
        id: string;
        name: string | null;
        email: string;
    } | null;
}

/**
 * Public preview of an invitation, resolved from its token.
 *
 * Deliberately contains no user ids beyond the inviter's display name and no
 * raw email: anyone holding the link can read it before authenticating.
 */
export interface InvitationPreviewResponse {
    email: string;
    organizationName: string;
    organizationSlug: string;
    role: Role | string;
    invitedByName: string | null;
    status: InvitationStatus;
    expiresAt: Date | string;
    /** Whether an account already exists for the invited email. */
    accountExists: boolean;
}

/**
 * Result of accepting an invitation.
 */
export interface AcceptInvitationResponse {
    tenantId: string;
    organizationId: string;
    organizationSlug: string;
    organizationName: string;
    role: Role | string;
    /** True when the caller was already a member (idempotent accept). */
    alreadyMember: boolean;
}

/**
 * A report as exposed by the API.
 *
 * `filePath` is deliberately absent: it is server-side storage detail. Clients
 * download through `GET /reports/:id/download`, which re-checks tenant
 * membership — so a leaked id cannot be used to fetch another tenant's file.
 */
export interface ReportResponse {
    id: string;
    tenantId: string;
    type: ReportTypeName;
    format: ReportFormatName;
    status: ReportStateName;
    fileName: string | null;
    fileSize: number | null;
    rowCount: number | null;
    error: string | null;
    requestedById: string;
    startedAt: Date | string | null;
    completedAt: Date | string | null;
    createdAt: Date | string;
}

/** Result of requesting a new report: the row plus the enqueued job id. */
export interface CreateReportResponse extends ReportResponse {
    jobId: string | null;
}

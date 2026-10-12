import { Role } from "../constants";

/**
 * Input payloads shared between API and web.
 * These mirror the class-validator DTOs in apps/api (single source of truth
 * for the *shape*; the API owns the runtime validation decorators).
 */
export interface RegisterInput {
    email: string;
    password: string;
    name: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface RefreshTokenInput {
    refreshToken: string;
}

export interface UpdateUserInput {
    name?: string;
    image?: string;
}

export interface CreateOrganizationInput {
    name: string;
    slug?: string;
    logo?: string;
}

export interface UpdateOrganizationInput {
    name?: string;
    logo?: string;
}

export interface InviteMemberInput {
    email: string;
    role: Role;
}

export interface UpdateMemberRoleInput {
    role: Role;
}

/**
 * Request to generate a report. The API creates the row and enqueues the job.
 */
export interface CreateReportInput {
    type: "usage" | "members" | "billing";
    format: "csv" | "pdf";
}

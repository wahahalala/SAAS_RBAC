import { Plan, SubscriptionStatus, InvitationStatus, TenantStatus } from "../constants";

/**
 * Base user type
 */
export interface User {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Tenant (workspace root)
 */
export interface Tenant {
    id: string;
    name: string;
    slug: string;
    plan: Plan;
    status: TenantStatus;
    settings: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Organization - compatibility layer, 1:1 with Tenant.
 */
export interface Organization {
    id: string;
    tenantId: string;
    name: string;
    slug: string;
    logo: string | null;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Tenant membership (user + role within a tenant)
 */
export interface Membership {
    id: string;
    tenantId: string;
    userId: string;
    roleId: string;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * RBAC Role model (database entity). Distinct from the legacy `Role`
 * ("admin" | "member") string type in constants.
 */
export interface RoleModel {
    id: string;
    tenantId: string | null;
    name: string;
    key: string;
    description: string | null;
    isSystem: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * RBAC permission
 */
export interface Permission {
    id: string;
    key: string;
    name: string;
    description: string | null;
    createdAt: Date;
}

/**
 * Role <-> Permission link
 */
export interface RolePermission {
    id: string;
    roleId: string;
    permissionId: string;
    createdAt: Date;
}

/**
 * Legacy organization membership shape (compatibility).
 */
export interface OrganizationMember {
    id: string;
    userId: string;
    organizationId: string;
    role: string;
    user?: User;
    organization?: Organization;
    createdAt: Date;
}

/**
 * Subscription
 */
export interface Subscription {
    id: string;
    tenantId: string;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    stripePriceId: string | null;
    status: SubscriptionStatus;
    plan: Plan;
    currentPeriodStart: Date | null;
    currentPeriodEnd: Date | null;
    cancelAtPeriodEnd: boolean;
    createdAt: Date;
    updatedAt: Date;
}

/**
 * Usage record (metered billing)
 */
export interface UsageRecord {
    id: string;
    tenantId: string;
    metric: string;
    quantity: number;
    recordedAt: Date;
}

/**
 * Invitation
 */
export interface Invitation {
    id: string;
    tenantId: string;
    email: string;
    roleId: string | null;
    roleKey: string;
    token: string;
    expiresAt: Date;
    invitedById: string;
    invitedByOrgId: string | null;
    status: InvitationStatus;
    createdAt: Date;
}

/**
 * API Key
 */
export interface ApiKey {
    id: string;
    name: string;
    organizationId: string;
    keyPrefix: string;
    scopes: string[];
    lastUsedAt: Date | null;
    expiresAt: Date | null;
    createdAt: Date;
}

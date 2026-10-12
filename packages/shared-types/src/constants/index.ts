/**
 * Shared domain constants.
 *
 * Single source of truth for enum-like values shared across the API,
 * the web app and the worker. Types exported from this module are the
 * canonical in-memory shape of the corresponding Prisma enums.
 */

/**
 * User roles within an organization
 */
export const ROLES = {
    ADMIN: "admin",
    MEMBER: "member",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/**
 * Subscription plans
 */
export const PLANS = {
    FREE: "free",
    PRO: "pro",
    ENTERPRISE: "enterprise",
} as const;

export type Plan = (typeof PLANS)[keyof typeof PLANS];

/**
 * Subscription statuses
 */
export const SUBSCRIPTION_STATUS = {
    ACTIVE: "active",
    CANCELED: "canceled",
    PAST_DUE: "past_due",
    TRIALING: "trialing",
    INCOMPLETE: "incomplete",
} as const;

export type SubscriptionStatus =
    (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

/**
 * Invitation statuses
 */
export const INVITATION_STATUS = {
    PENDING: "pending",
    ACCEPTED: "accepted",
    EXPIRED: "expired",
    CANCELED: "canceled",
} as const;

export type InvitationStatus =
    (typeof INVITATION_STATUS)[keyof typeof INVITATION_STATUS];

/**
 * Tenant statuses
 */
export const TENANT_STATUS = {
    ACTIVE: "active",
    SUSPENDED: "suspended",
    DELETING: "deleting",
} as const;

export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS];

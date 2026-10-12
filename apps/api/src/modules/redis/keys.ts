/**
 * Centralised Redis key builders.
 *
 * Namespacing + well-known prefixes are what make invalidation predictable:
 * every tenant-scoped key starts with `tenant:{tenantId}:` so invalidation is
 * a single pattern delete (`DEL` via SCAN) or key deletion by exact name.
 */

export const RedisKeys = {
    /** RBAC permission cache: tenant:{id}:user:{id}:permissions */
    permissions: (tenantId: string, userId: string) =>
        `tenant:${tenantId}:user:${userId}:permissions`,

    /** Tenant settings cache: tenant:{id}:settings */
    settings: (tenantId: string) => `tenant:${tenantId}:settings`,

    /** Organization-by-slug cache: tenant:{id}:organization:bySlug:{slug} */
    organizationBySlug: (tenantId: string, slug: string) =>
        `tenant:${tenantId}:organization:bySlug:${slug}`,

    /** Login rate limit: ratelimit:login:{email|ip}:... */
    loginRateLimit: (key: string) => `ratelimit:login:${key}`,

    /** Everything under a tenant (for full invalidation). */
    tenantScope: (tenantId: string) => `tenant:${tenantId}:*`,
} as const;

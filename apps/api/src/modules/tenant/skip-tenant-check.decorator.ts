import { SetMetadata } from "@nestjs/common";

export const SKIP_TENANT_CHECK = "skipTenantCheck";

/**
 * Mark a route as NOT requiring a tenant.
 *
 * Only use for genuinely cross-tenant / tenant-provisioning operations
 * (e.g. POST /tenants, or health checks). Business data endpoints must always
 * enforce tenant isolation.
 */
export const SkipTenantCheck = () => SetMetadata(SKIP_TENANT_CHECK, true);

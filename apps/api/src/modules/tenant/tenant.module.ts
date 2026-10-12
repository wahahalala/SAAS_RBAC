import { Global, Module } from "@nestjs/common";
import { TenantContext } from "./tenant.context";
import { TenantGuard } from "./tenant.guard";
import { TenantInterceptor } from "./tenant.interceptor";

/**
 * Tenant isolation module.
 *
 * Provides TenantContext (AsyncLocalStorage), TenantGuard (validates the
 * X-Tenant-Id header + membership) and TenantInterceptor (wraps the request
 * in the tenant context).
 */
@Global()
@Module({
    providers: [TenantContext, TenantGuard, TenantInterceptor],
    exports: [TenantContext, TenantGuard, TenantInterceptor],
})
export class TenantModule {}

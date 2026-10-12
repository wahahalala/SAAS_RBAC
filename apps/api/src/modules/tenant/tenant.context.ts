import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";

export interface TenantContextData {
    tenantId: string;
    userId?: string;
}

/**
 * Shared AsyncLocalStorage instance.
 *
 * Exported as a bare singleton (rather than only through the service) so
 * helpers outside the DI graph — e.g. integration tests — can open the same
 * request context the interceptor uses.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContextData>();

/**
 * Request-scoped tenant context backed by AsyncLocalStorage.
 *
 * TenantGuard validates the tenant and TenantInterceptor opens the context for
 * every authenticated request; services read the current tenantId from here to
 * scope their own queries (there is no Prisma auto-scoping layer — see
 * PrismaService for why).
 */
@Injectable()
export class TenantContext {
    run<T>(data: TenantContextData, fn: () => T): T {
        return tenantStorage.run(data, fn);
    }

    get(): TenantContextData | undefined {
        return tenantStorage.getStore();
    }

    getTenantId(): string | undefined {
        return tenantStorage.getStore()?.tenantId;
    }

    getUserId(): string | undefined {
        return tenantStorage.getStore()?.userId;
    }

    requireTenantId(): string {
        const tenantId = this.getTenantId();
        if (!tenantId) {
            throw new Error(
                "TenantContext is not initialized. Did TenantGuard run?",
            );
        }
        return tenantId;
    }
}

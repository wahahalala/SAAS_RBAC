import { AsyncLocalStorage } from "node:async_hooks";
import { Injectable } from "@nestjs/common";

export interface TenantContextData {
    tenantId: string;
    userId?: string;
}

/**
 * Shared AsyncLocalStorage instance so both the NestJS TenantContext service
 * and the low-level Prisma client extension can read the same request context
 * without circular dependency issues.
 */
export const tenantStorage = new AsyncLocalStorage<TenantContextData>();

/**
 * Request-scoped tenant context backed by AsyncLocalStorage.
 *
 * TenantGuard populates it for every authenticated request; services and the
 * Prisma client extension read the current tenantId from here.
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

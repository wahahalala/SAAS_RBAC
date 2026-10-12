import { CacheService } from "./cache.service";

/**
 * Module-level reference so @Cache(...) decorator can access CacheService
 * without circular DI. CacheModule sets it in onModuleInit.
 */
let cacheServiceRef: CacheService | null = null;

export function setCacheService(service: CacheService): void {
    cacheServiceRef = service;
}

interface CacheOptions {
    /** Seconds. Default 300 (5 minutes). */
    ttl?: number;
    /** Static key prefix. Defaults to the method name. */
    keyPrefix?: string;
}

/**
 * Method-level cache decorator.
 *
 * Key = `{keyPrefix || methodName}:{JSON.stringify(args)}`.
 * On cache hit the cached value is returned; on miss the method runs and its
 * result is stored with the given TTL. Invalidation is the caller's
 * responsibility (see CacheService.invalidate / invalidatePattern).
 */
export function Cache(options: CacheOptions = {}) {
    const ttl = options.ttl ?? 300;

    return function (
        _target: unknown,
        propertyKey: string,
        descriptor: PropertyDescriptor,
    ) {
        const originalMethod = descriptor.value;

        descriptor.value = async function (...args: unknown[]) {
            const cacheService = cacheServiceRef;
            const prefix = options.keyPrefix ?? propertyKey;

            let cacheKey: string;
            try {
                cacheKey = `${prefix}:${JSON.stringify(args)}`;
            } catch {
                // Unserialisable args — fall through to the real method.
                return originalMethod.apply(this, args);
            }

            const cached = cacheService
                ? await cacheService.get<unknown>(cacheKey)
                : null;
            if (cached !== null && cached !== undefined) {
                return cached;
            }

            const result = await originalMethod.apply(this, args);

            if (cacheService) {
                await cacheService.set(cacheKey, result, ttl);
            }
            return result;
        };

        return descriptor;
    };
}

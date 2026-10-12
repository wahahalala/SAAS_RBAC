import { Injectable } from "@nestjs/common";
import { RedisService } from "./redis.service";

const DEFAULT_TTL_SECONDS = 300; // 5 minutes

/**
 * High-level cache API with a consistent TTL and JSON (de)serialization.
 *
 * Invalidation strategy:
 *   - Explicit `invalidate(key)` for a single entry.
 *   - `invalidatePattern(pattern)` for namespace invalidation, e.g.
 *     RedisKeys.tenantScope(tenantId) -> `tenant:{id}:*`.
 *   - TTL is the safety net: even if an explicit invalidation is missed, stale
 *     values expire automatically.
 */
@Injectable()
export class CacheService {
    constructor(private readonly redis: RedisService) {}

    async get<T>(key: string): Promise<T | null> {
        const raw = await this.redis.get(key);
        if (raw === null) {
            return null;
        }
        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    }

    async set<T>(
        key: string,
        value: T,
        ttlSeconds: number = DEFAULT_TTL_SECONDS,
    ): Promise<void> {
        await this.redis.set(key, JSON.stringify(value), ttlSeconds);
    }

    async invalidate(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async invalidatePattern(pattern: string): Promise<number> {
        return this.redis.deleteByPattern(pattern);
    }

    /**
     * Invalidate everything belonging to a tenant.
     */
    async invalidateTenant(tenantId: string): Promise<number> {
        return this.invalidatePattern(`tenant:${tenantId}:*`);
    }
}

import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

/**
 * Low-level Redis wrapper (ioredis).
 *
 * Exposes the raw client for advanced use plus a few typed convenience
 * methods. CacheService (above this) is the preferred API for key/value
 * caching; use RedisService directly for counters (rate limiting) and health.
 */
@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
    readonly client: Redis;

    constructor(private readonly configService: ConfigService) {
        const host = this.configService.get("REDIS_HOST", "localhost");
        const port = this.configService.get<number>("REDIS_PORT", 6379);
        const url = this.configService.get("REDIS_URL");

        this.client = url
            ? new Redis(url, { maxRetriesPerRequest: 2 })
            : new Redis({ host, port, maxRetriesPerRequest: 2 });
    }

    async onModuleInit(): Promise<void> {
        // Fail fast if Redis is unreachable at boot.
        await this.client.ping();
    }

    async onModuleDestroy(): Promise<void> {
        await this.client.quit();
    }

    /** Ping - for health checks. */
    async ping(): Promise<boolean> {
        try {
            return (await this.client.ping()) === "PONG";
        } catch {
            return false;
        }
    }

    /** INCR and set the TTL on first increment (atomic-enough for rate limiting). */
    async increment(key: string, ttlSeconds: number): Promise<number> {
        const count = await this.client.incr(key);
        if (count === 1) {
            await this.client.expire(key, ttlSeconds);
        }
        return count;
    }

    async get(key: string): Promise<string | null> {
        return this.client.get(key);
    }

    async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
        if (ttlSeconds !== undefined) {
            await this.client.set(key, value, "EX", ttlSeconds);
        } else {
            await this.client.set(key, value);
        }
    }

    async del(...keys: string[]): Promise<number> {
        return this.client.del(...keys);
    }

    /**
     * Delete all keys matching a pattern (e.g. `tenant:{id}:*`).
     * Uses SCAN to avoid blocking Redis with KEYS on large datasets.
     */
    async deleteByPattern(pattern: string): Promise<number> {
        let cursor = "0";
        let deleted = 0;

        do {
            const [nextCursor, keys] = await this.client.scan(
                cursor,
                "MATCH",
                pattern,
                "COUNT",
                100,
            );
            cursor = nextCursor;

            if (keys.length > 0) {
                deleted += await this.client.del(...keys);
            }
        } while (cursor !== "0");

        return deleted;
    }
}

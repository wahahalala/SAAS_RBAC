import { Global, Module, OnModuleInit } from "@nestjs/common";
import { RedisService } from "./redis.service";
import { CacheService } from "./cache.service";
import { setCacheService } from "./cache.decorator";

/**
 * Redis infrastructure module (global).
 *
 * Provides RedisService (low-level) and CacheService (typed JSON cache).
 * Registers the module-level CacheService reference used by @Cache().
 */
@Global()
@Module({
    providers: [RedisService, CacheService],
    exports: [RedisService, CacheService],
})
export class RedisModule implements OnModuleInit {
    constructor(private readonly cacheService: CacheService) {}

    onModuleInit(): void {
        setCacheService(this.cacheService);
    }
}

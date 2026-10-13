import { Controller, Get, Res } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { Response } from "express";
import { PrismaService } from "@/prisma/prisma.service";
import { RedisService } from "@/modules/redis/redis.service";

/**
 * Liveness/readiness probe for the orchestrator.
 *
 * `GET /api/v1/health` runs real dependency checks (not just "the process is up")
 * so that Compose/Kubernetes/Nginx only route traffic when the API can actually
 * serve it. The endpoint is public so the probe needs no credentials, and it is
 * NOT tenant-scoped — it checks infrastructure, not user data.
 *
 * Response:
 *  - 200 when every dependency reports up.
 *  - 503 when any dependency is down (so `depends_on: { condition: service_healthy }`
 *    and reverse-proxy upstream checks fail the container instead of timing out).
 */
@ApiTags("Health")
@Controller("health")
export class HealthController {
    constructor(
        private readonly prisma: PrismaService,
        private readonly redis: RedisService,
    ) {}

    @Get()
    @ApiOperation({ summary: "Health check" })
    async check(@Res() res: Response) {
        const [dbHealthy, redisHealthy] = await Promise.all([
            this.checkDatabase(),
            this.redis.ping(),
        ]);

        const healthy = dbHealthy && redisHealthy;

        return res.status(healthy ? 200 : 503).json({
            status: healthy ? "healthy" : "unhealthy",
            timestamp: new Date().toISOString(),
            services: {
                database: dbHealthy ? "up" : "down",
                redis: redisHealthy ? "up" : "down",
            },
        });
    }

    private async checkDatabase(): Promise<boolean> {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return true;
        } catch {
            return false;
        }
    }
}

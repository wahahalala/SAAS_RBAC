import { Controller, Get } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { PrismaService } from "@/prisma/prisma.service";

@ApiTags("Health")
@Controller("health")
export class HealthController {
    constructor(private readonly prisma: PrismaService) { }

    @Get()
    @ApiOperation({ summary: "Health check" })
    async check() {
        const dbHealthy = await this.checkDatabase();

        return {
            status: dbHealthy ? "healthy" : "unhealthy",
            timestamp: new Date().toISOString(),
            services: {
                database: dbHealthy ? "up" : "down",
            },
        };
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

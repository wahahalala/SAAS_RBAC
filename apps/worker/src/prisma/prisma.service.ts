import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma client for the worker.
 *
 * The worker READS business data to build reports and WRITES the `Report` row's
 * status. There is no per-request tenant context here (no HTTP), so every query
 * must be scoped explicitly — the tenantId always comes from the job payload,
 * which the API derived from an authorised request.
 */
@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    constructor() {
        super({
            log:
                process.env.NODE_ENV === "development"
                    ? ["warn", "error"]
                    : ["error"],
        });
    }

    async onModuleInit(): Promise<void> {
        await this.$connect();
    }

    async onModuleDestroy(): Promise<void> {
        await this.$disconnect();
    }
}

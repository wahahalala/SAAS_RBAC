import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma database service.
 *
 * TENANT ISOLATION NOTE
 * ---------------------
 * Tenant scoping is enforced by TenantGuard (which validates the `X-Tenant-Id`
 * header against the caller's Membership and stores the resolved id on the
 * request) plus explicit `tenantId` filters in each service query. There is no
 * Prisma-level auto-scoping extension: an earlier `$extends`-based
 * `tenantDb` client was never wired into any service and has been removed
 * rather than left in place implying a guarantee it did not provide.
 *
 * Consequences to keep in mind when adding a query on a tenant-scoped model
 * (Tenant, Organization, Membership, Role, Invitation, Subscription,
 * AuditLog, UsageRecord): you MUST filter by tenantId yourself. Use
 * `TenantContext.getTenantId()` (or `@CurrentTenantId()`) — never a value
 * taken from the request body or query string.
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
                    ? ["query", "info", "warn", "error"]
                    : ["error"],
        });
    }

    async onModuleInit() {
        await this.$connect();
    }

    async onModuleDestroy() {
        await this.$disconnect();
    }

    /**
     * Clean database (for testing)
     */
    async cleanDatabase() {
        if (process.env.NODE_ENV === "production") {
            throw new Error("Cannot clean database in production");
        }

        const tablenames = await this.$queryRaw<
            Array<{ tablename: string }>
        >`SELECT tablename FROM pg_tables WHERE schemaname='public'`;

        const tables = tablenames
            .map(({ tablename }) => tablename)
            .filter((name) => name !== "_prisma_migrations")
            .map((name) => `"public"."${name}"`)
            .join(", ");

        if (tables.length > 0) {
            await this.$executeRawUnsafe(`TRUNCATE TABLE ${tables} CASCADE;`);
        }
    }
}

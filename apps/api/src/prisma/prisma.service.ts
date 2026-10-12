import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { Prisma, PrismaClient } from "@prisma/client";
import { tenantStorage } from "@/modules/tenant/tenant.context";

/**
 * Models whose rows belong to a tenant and therefore must always be scoped by
 * tenantId. `notification` is intentionally omitted: its tenantId is nullable
 * for global notifications.
 */
const TENANT_SCOPED_MODELS = new Set<Prisma.ModelName>([
    "Tenant",
    "Organization",
    "Membership",
    "Role",
    "Invitation",
    "Subscription",
    "AuditLog",
    "UsageRecord",
]);

const READ_OPERATIONS = new Set([
    "findMany",
    "findFirst",
    "findUnique",
    "count",
    "aggregate",
    "groupBy",
]);

function currentTenantId(): string | undefined {
    return tenantStorage.getStore()?.tenantId;
}

function forceTenantScope(args: any, tenantId: string, operation: string): void {
    if (!args || typeof args !== "object") return;

    // CREATE: when a tenant context exists, force the row into the current
    // tenant (caller can never create cross-tenant rows). Without a context,
    // explicit creation (e.g. provisioning a new Tenant) is allowed.
    if ("data" in args && args.data && typeof args.data === "object") {
        if (Array.isArray(args.data)) {
            for (const item of args.data) {
                if (item && typeof item === "object") {
                    item.tenantId = tenantId;
                }
            }
        } else {
            args.data.tenantId = tenantId;
        }
    }

    // Upsert create branch.
    if (args.create && typeof args.create === "object") {
        args.create.tenantId = tenantId;
    }

    // For READ operations there may be no `where` at all (e.g. findMany()).
    // Always ensure a tenantId filter exists, overwriting any user value.
    if (READ_OPERATIONS.has(operation)) {
        if (args.where && typeof args.where === "object") {
            args.where.tenantId = tenantId;
        } else {
            args.where = { tenantId };
        }
        return;
    }

    // Mutations with an existing where: OVERWRITE tenantId.
    if ("where" in args && args.where && typeof args.where === "object") {
        args.where.tenantId = tenantId;
    }
}

function buildTenantScopedClient(raw: PrismaClient) {
    return raw.$extends({
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }: any) {
                    if (!TENANT_SCOPED_MODELS.has(model as Prisma.ModelName)) {
                        return query(args);
                    }

                    const tenantId = currentTenantId();

                    // Reads and mutations on tenant data REQUIRE a tenant
                    // context (fail closed). Creation may be cross-tenant when
                    // provisioning (no context) — but never from within a
                    // different tenant's context (forced scope above).
                    if (
                        tenantId === undefined &&
                        (READ_OPERATIONS.has(operation as string) ||
                            operation === "update" ||
                            operation === "updateMany" ||
                            operation === "delete" ||
                            operation === "deleteMany" ||
                            operation === "upsert")
                    ) {
                        throw new Error(
                            `Tenant context is required for '${String(model)}.${String(operation)}'`,
                        );
                    }

                    if (tenantId !== undefined) {
                        forceTenantScope(args, tenantId, operation as string);
                    }

                    return query(args);
                },
            },
        },
    });
}

export type TenantPrismaClient = ReturnType<typeof buildTenantScopedClient>;

@Injectable()
export class PrismaService
    extends PrismaClient
    implements OnModuleInit, OnModuleDestroy
{
    /** Tenant-isolated client: auto-injects `where.tenantId`. */
    readonly tenantDb: TenantPrismaClient;

    constructor() {
        super({
            log:
                process.env.NODE_ENV === "development"
                    ? ["query", "info", "warn", "error"]
                    : ["error"],
        });

        this.tenantDb = buildTenantScopedClient(this);
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

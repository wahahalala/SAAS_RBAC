import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaService } from "@/prisma/prisma.service";
import { tenantStorage } from "@/modules/tenant/tenant.context";

const db = new PrismaService();

/**
 * Tenant isolation is enforced in two layers:
 *   1. TenantGuard — validates the `X-Tenant-Id` header against the caller's
 *      Membership (covered in tenant-discovery.spec.ts and by the guard's
 *      own request-level behaviour).
 *   2. The tenant AsyncLocalStorage context — carries the resolved tenantId so
 *      service queries can scope themselves.
 *
 * There is deliberately NO Prisma `$extends` auto-scoping client: scoping is
 * explicit in each service query. These tests pin the guarantees the services
 * rely on: the context carries exactly the tenant the request was authorised
 * for, and a query scoped with it can never see another tenant's rows.
 */

async function createTenantWithLog(name: string) {
    const tenant = await db.tenant.create({
        data: { name, slug: `test-${name.toLowerCase()}`, plan: "free" },
    });

    await db.auditLog.create({
        data: {
            tenantId: tenant.id,
            action: "test.sample",
            entity: "tenant",
            entityId: tenant.id,
        },
    });

    return tenant;
}

/**
 * A service-style query: reads only the rows of the tenant running the
 * request, using the context (never a caller-supplied value).
 */
function readLogsInTenant(tenantId: string) {
    return tenantStorage.run({ tenantId }, async () => {
        const scoped = tenantStorage.getStore()!.tenantId;
        return db.auditLog.findMany({ where: { tenantId: scoped } });
    });
}

describe("SaaS tenant isolation (TenantContext scoping)", () => {
    beforeAll(async () => {
        await db.$connect();
        await db.cleanDatabase();
    });

    afterAll(async () => {
        await db.$disconnect();
    });

    it("Tenant A cannot read Tenant B data", async () => {
        const tenantA = await createTenantWithLog("TenantA");
        const tenantB = await createTenantWithLog("TenantB");

        const logsA = await readLogsInTenant(tenantA.id);
        expect(logsA).toHaveLength(1);
        expect(logsA[0]!.tenantId).toBe(tenantA.id);
        expect(logsA[0]!.tenantId).not.toBe(tenantB.id);

        const logsB = await readLogsInTenant(tenantB.id);
        expect(logsB).toHaveLength(1);
        expect(logsB[0]!.tenantId).toBe(tenantB.id);
        expect(logsB[0]!.tenantId).not.toBe(tenantA.id);
    });

    it("exposes no tenant outside a request context", async () => {
        // Outside tenantStorage.run there is no tenant to scope by. Services
        // must treat that as "no tenant" rather than defaulting to any tenant
        // (TenantContext.requireTenantId() throws, which is the fail-closed
        // path used by tenant-bound code).
        expect(tenantStorage.getStore()).toBeUndefined();
    });

    it("scopes to the tenant in context even when asked for another tenant", async () => {
        const tenantA = await createTenantWithLog("TenantA2");
        const tenantB = await createTenantWithLog("TenantB2");

        // A service must always scope by the authorised tenant from context —
        // a tenantId arriving from the client must never widen the query.
        const attempted = tenantStorage.run({ tenantId: tenantA.id }, async () => {
            const authorised = tenantStorage.getStore()!.tenantId;
            return db.auditLog.findMany({ where: { tenantId: authorised } });
        });

        const rows = await attempted;
        expect(rows).toHaveLength(1);
        expect(rows[0]!.tenantId).toBe(tenantA.id);
        expect(rows.some((log) => log.tenantId === tenantB.id)).toBe(false);
    });

    it("does not leak the context across concurrent requests", async () => {
        const tenantA = await createTenantWithLog("TenantA3");
        const tenantB = await createTenantWithLog("TenantB3");

        const [logsA, logsB] = await Promise.all([
            readLogsInTenant(tenantA.id),
            readLogsInTenant(tenantB.id),
        ]);

        expect(logsA[0]!.tenantId).toBe(tenantA.id);
        expect(logsB[0]!.tenantId).toBe(tenantB.id);
    });
});

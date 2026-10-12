import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaService } from "@/prisma/prisma.service";
import { tenantStorage, TenantContextData } from "@/modules/tenant/tenant.context";

const db = new PrismaService();

/**
 * Seed two tenants + one audit log each, directly (no tenant context).
 * This simulates provisioning time, where explicit tenantId is allowed.
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

function readLogsInTenant(data: TenantContextData) {
    // await INSIDE tenantStorage.run so the AsyncLocalStorage context is
    // visible when the Prisma promise actually executes.
    return tenantStorage.run(data, async () => {
        return db.tenantDb.auditLog.findMany();
    });
}

describe("SaaS Tenant Isolation (Prisma client extension)", () => {
    beforeAll(async () => {
        await db.$connect();
        await db.cleanDatabase();
    });

    afterAll(async () => {
        await db.$disconnect();
    });

    it("Tenant A cannot read Tenant B data via the tenant-scoped client", async () => {
        const tenantA = await createTenantWithLog("TenantA");
        const tenantB = await createTenantWithLog("TenantB");

        // In Tenant A's context, only Tenant A's audit logs are visible,
        // regardless of what the caller requests.
        const logsA = await readLogsInTenant({ tenantId: tenantA.id });
        expect(logsA).toHaveLength(1);
        expect(logsA[0]!.tenantId).toBe(tenantA.id);
        expect(logsA[0]!.tenantId).not.toBe(tenantB.id);

        // In Tenant B's context, only Tenant B's audit logs are visible.
        const logsB = await readLogsInTenant({ tenantId: tenantB.id });
        expect(logsB).toHaveLength(1);
        expect(logsB[0]!.tenantId).toBe(tenantB.id);
        expect(logsB[0]!.tenantId).not.toBe(tenantA.id);
    });

    it("fails closed on tenant-scoped reads when the tenant context is missing", async () => {
        // Outside tenantStorage.run, tenant-scoped reads must be rejected
        // rather than returning cross-tenant data.
        await expect(db.tenantDb.auditLog.findMany()).rejects.toThrow(
            /Tenant context/,
        );
    });

    it("cannot widen scope by passing a different tenantId in where", async () => {
        const tenantA = await createTenantWithLog("TenantA2");
        const tenantB = await createTenantWithLog("TenantB2");

        // Even if the caller tries to query tenantB's rows from tenantA's
        // context, the extension OVERWRITES where.tenantId with tenantA.
        const sneaky = await tenantStorage.run({ tenantId: tenantA.id }, async () =>
            db.tenantDb.auditLog.findMany({
                where: { tenantId: tenantB.id },
            }),
        );

        expect(sneaky).toHaveLength(1);
        expect(sneaky[0]!.tenantId).toBe(tenantA.id);
        expect(sneaky.every((log) => log.tenantId !== tenantB.id)).toBe(true);
    });
});

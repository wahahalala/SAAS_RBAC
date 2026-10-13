import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { createWorld, resetWorld, E2eWorld } from "./world";

/**
 * Tenant isolation end-to-end.
 *
 * These assertions would catch a regression even if every unit test passed: the
 * isolation boundary is the combination of TenantGuard, TenantInterceptor and
 * each service's query scoping, which only a full request exercises.
 */
describe("Tenant Isolation (e2e)", () => {
    let world: E2eWorld;

    beforeAll(async () => {
        world = await createWorld();
    });

    afterAll(async () => {
        await world.app.close();
    });

    beforeEach(async () => {
        await resetWorld(world);
    });

    async function seedAuditRow(tenantId: string, action: string) {
        return world.prisma.auditLog.create({
            data: {
                tenantId,
                userId: world.adminUser.id,
                action,
                entity: "User",
                entityId: world.adminUser.id,
            },
        });
    }

    it("a tenant-bound request without X-Tenant-Id is rejected", async () => {
        await world.http
            .get("/api/v1/projects")
            .set("Authorization", `Bearer ${world.adminToken}`)
            .expect(403);
    });

    it("a member sees only their own tenant's audit rows", async () => {
        await seedAuditRow(world.tenantAId, "TENANT_A_ONLY");
        await seedAuditRow(world.tenantBId, "TENANT_B_ONLY");

        const list = await world.http
            .get("/api/v1/audit-logs?search=TENANT_")
            .set("Authorization", `Bearer ${world.adminToken}`)
            .set("X-Tenant-Id", world.tenantAId)
            .expect(200);

        const actions = list.body.items.map((row: { action: string }) => row.action);
        expect(actions).toContain("TENANT_A_ONLY");
        expect(actions).not.toContain("TENANT_B_ONLY");
    });

    it("scope cannot be widened with another tenant's X-Tenant-Id", async () => {
        await seedAuditRow(world.tenantBId, "TENANT_B_ONLY");

        // The admin is NOT a member of tenant B, so even sending that header is
        // rejected — not merely filtered.
        await world.http
            .get("/api/v1/audit-logs")
            .set("Authorization", `Bearer ${world.adminToken}`)
            .set("X-Tenant-Id", world.tenantBId)
            .expect(403);
    });

    it("the outsider (tenant B) cannot read tenant A data", async () => {
        await seedAuditRow(world.tenantAId, "TENANT_A_ONLY");

        await world.http
            .get("/api/v1/audit-logs?search=TENANT_A")
            .set("Authorization", `Bearer ${world.outsiderToken}`)
            .set("X-Tenant-Id", world.tenantBId)
            .expect(200)
            .expect((response) => {
                expect(
                    (response.body.items as Array<{ action: string }>).length,
                ).toBe(0);
            });
    });

    it("user-level endpoints work without a tenant (discovery is not tenant-scoped)", async () => {
        const organizations = await world.http
            .get("/api/v1/users/me/organizations")
            .set("Authorization", `Bearer ${world.adminToken}`)
            .expect(200);

        expect(Array.isArray(organizations.body)).toBe(true);
        expect(organizations.body.length).toBe(1); // admin only belongs to A
    });
});

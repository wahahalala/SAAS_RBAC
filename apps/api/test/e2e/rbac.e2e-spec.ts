import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";
import { createWorld, resetWorld, E2eWorld } from "./world";

/**
 * RBAC + permission enforcement end-to-end.
 *
 * `projects` is the reference surface: each route requires a different
 * permission, which lets us assert BOTH directions — an admin passes, a member
 * (same tenant, no permissions) fails — through the real PermissionGuard.
 */
describe("RBAC + permissions (e2e)", () => {
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

    it("lists the caller's effective permissions", async () => {
        const permissions = await world.http
            .get("/api/v1/auth/me/permissions")
            .set("Authorization", `Bearer ${world.adminToken}`)
            .set("X-Tenant-Id", world.tenantAId)
            .expect(200);

        expect(permissions.body.permissions).toEqual(
            expect.arrayContaining(["project.read", "project.create", "project.update"]),
        );
    });

    it("a member with no grants has an empty permission set", async () => {
        const permissions = await world.http
            .get("/api/v1/auth/me/permissions")
            .set("Authorization", `Bearer ${world.memberToken}`)
            .set("X-Tenant-Id", world.tenantAId)
            .expect(200);

        expect(permissions.body.permissions).toEqual([]);
    });

    it.each([
        ["GET /projects", "get", "/api/v1/projects", "project.read"],
        ["POST /projects", "post", "/api/v1/projects", "project.create"],
        ["PATCH /projects/:id", "patch", "/api/v1/projects/1", "project.update"],
    ])("admin passes %s", async (_label, method, url) => {
        await (world.http as any)[method](url)
            .set("Authorization", `Bearer ${world.adminToken}`)
            .set("X-Tenant-Id", world.tenantAId)
            .expect((response: { status: number }) => {
                expect(response.status).toBeLessThan(400);
            });
    });

    it.each([
        ["GET /projects", "get", "/api/v1/projects"],
        ["POST /projects", "post", "/api/v1/projects"],
        ["PATCH /projects/:id", "patch", "/api/v1/projects/1"],
    ])("member is forbidden on %s", async (_label, method, url) => {
        await (world.http as any)[method](url)
            .set("Authorization", `Bearer ${world.memberToken}`)
            .set("X-Tenant-Id", world.tenantAId)
            .expect(403);
    });

    it("a permission check without a tenant context is rejected", async () => {
        await world.http
            .get("/api/v1/projects")
            .set("Authorization", `Bearer ${world.adminToken}`)
            .expect(403);
    });

    it("grants do not leak across tenants", async () => {
        // The outsider is an admin in tenant B but must not use those grants
        // against tenant A — they are not even a member there.
        await world.http
            .get("/api/v1/projects")
            .set("Authorization", `Bearer ${world.outsiderToken}`)
            .set("X-Tenant-Id", world.tenantAId)
            .expect(403);
    });

    it("reports a clear reason for a permission denial", async () => {
        const response = await world.http
            .post("/api/v1/projects")
            .send({})
            .set("Authorization", `Bearer ${world.memberToken}`)
            .set("X-Tenant-Id", world.tenantAId)
            .expect(403);

        expect(response.body.message ?? response.body.error?.message).toMatch(
            /project\.create|permission/i,
        );
    });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "@/prisma/prisma.service";
import { UsersService } from "@/modules/users/users.service";
import { SKIP_TENANT_CHECK } from "@/modules/tenant";
import { IS_PUBLIC_KEY } from "@/common/decorators";
import { UsersController } from "@/modules/users/users.controller";
import { AuthController } from "@/modules/auth/auth.controller";
import { OrganizationsController } from "@/modules/organizations/organizations.controller";

/**
 * The active tenant is discovered from `GET /users/me/organizations`, and every
 * tenant-bound request afterwards sends `X-Tenant-Id`.
 *
 * Two things must hold for that flow to work:
 *   1. The discovery endpoints are marked `@SkipTenantCheck()` — otherwise
 *      TenantGuard would demand a tenant header BEFORE the client can learn
 *      which tenant to send, deadlocking the client.
 *   2. The membership payload exposes `tenantId` (not just the Organization row
 *      id), so the client sends a value TenantGuard can authorise.
 */

const db = new PrismaService();
const usersService = new UsersService(db);
const reflector = new Reflector();

let tenantAId!: string;
let tenantBId!: string;
let userId!: string;

beforeAll(async () => {
    await db.$connect();
    await db.cleanDatabase();

    const user = await db.user.create({
        data: { email: "tenant-discovery@example.com", name: "Discovery User" },
    });
    userId = user.id;

    for (const [name, slug] of [
        ["Discovery Tenant A", "discovery-tenant-a"],
        ["Discovery Tenant B", "discovery-tenant-b"],
    ]) {
        const tenant = await db.tenant.create({
            data: { name, slug, plan: "free" },
        });

        if (slug.endsWith("-a")) tenantAId = tenant.id;
        else tenantBId = tenant.id;

        await db.organization.create({
            data: { tenantId: tenant.id, name, slug },
        });

        const role = await db.role.create({
            data: { key: `member-${slug}`, name: "Member", isSystem: false, tenantId: tenant.id },
        });

        await db.membership.create({
            data: { tenantId: tenant.id, userId, roleId: role.id },
        });
    }
});

afterAll(async () => {
    await db.$disconnect();
});

describe("tenant discovery endpoint", () => {
    it("is resolvable without an X-Tenant-Id header", () => {
        const handler = reflector.get<boolean>(
            SKIP_TENANT_CHECK,
            (UsersController.prototype as any).getOrganizations,
        );

        expect(handler).toBe(true);
    });

    it("does not require authentication to be skipped (JWT still applies)", () => {
        const isPublic = reflector.get<boolean>(
            IS_PUBLIC_KEY,
            (UsersController.prototype as any).getOrganizations,
        );

        expect(isPublic).toBeUndefined();
    });

    it("exposes the tenantId the client must send back as X-Tenant-Id", async () => {
        const organizations = await usersService.getOrganizations(userId);

        expect(organizations).toHaveLength(2);
        expect(organizations.map((org) => org.tenantId).sort()).toEqual(
            [tenantAId, tenantBId].sort(),
        );
    });

    it("only returns tenants the user is actually a member of", async () => {
        const organizations = await usersService.getOrganizations(userId);
        const returnedIds = organizations.map((org) => org.tenantId);

        // A tenant the user has no Membership in must never be discoverable.
        const otherTenant = await db.tenant.create({
            data: { name: "Not A Member", slug: "not-a-member", plan: "free" },
        });

        expect(returnedIds).not.toContain(otherTenant.id);
        expect(returnedIds).toContain(tenantAId);
    });
});

describe("user-level endpoints are not tenant-scoped", () => {
    const cases: Array<[string, string]> = [
        ["UsersController", "getProfile"],
        ["UsersController", "updateProfile"],
        ["UsersController", "deleteAccount"],
        ["AuthController", "me"],
    ];

    it.each(cases)("%s.%s skips the tenant check", (controller, method) => {
        const target =
            controller === "UsersController"
                ? (UsersController.prototype as any)
                : (AuthController.prototype as any);

        expect(reflector.get<boolean>(SKIP_TENANT_CHECK, target[method])).toBe(
            true,
        );
    });

    it("keeps /auth/me/permissions tenant-scoped", () => {
        const skip = reflector.get<boolean>(
            SKIP_TENANT_CHECK,
            AuthController.prototype.myPermissions,
        );

        // Permissions are meaningless without a tenant, so the guard must run.
        expect(skip).toBeFalsy();
    });

    it("keeps organization provisioning tenant-free", () => {
        const skip = reflector.get<boolean>(
            SKIP_TENANT_CHECK,
            OrganizationsController.prototype.create,
        );

        expect(skip).toBe(true);
    });
});

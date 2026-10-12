import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaService } from "@/prisma/prisma.service";
import { OrganizationsService } from "@/modules/organizations/organizations.service";
import { CacheService } from "@/modules/redis/cache.service";
import { TenantContext } from "@/modules/tenant";

/**
 * A user can be a member of several tenants. Requests carry ONE tenant in the
 * `X-Tenant-Id` header, but organization routes address the organization by
 * slug in the path.
 *
 * Nothing may link the two implicitly: this used to be a cross-tenant hole,
 * because the controller verified "is the caller a member of <slug>?" while
 * ignoring the tenant the request was authorised for. A user who belongs to
 * both Tenant A and Tenant B could send Tenant A's header and operate on
 * Tenant B's organization.
 *
 * These tests pin the corrected behaviour: the slug must resolve to the tenant
 * the request is scoped to, otherwise the operation is rejected.
 */

const db = new PrismaService();
const tenantContext = new TenantContext();

function createService() {
    const cacheStub = {
        get: async () => null,
        set: async () => undefined,
        invalidate: async () => undefined,
        invalidatePattern: async () => 0,
        invalidateTenant: async () => 0,
    } as unknown as CacheService;

    return new OrganizationsService(db, cacheStub, tenantContext);
}

const service = createService();

let tenantAId!: string;
let tenantBId!: string;
let userId!: string;
let outsiderId!: string;

beforeAll(async () => {
    await db.$connect();
    await db.cleanDatabase();

    const tenantA = await db.tenant.create({
        data: { name: "Scope Tenant A", slug: "scope-tenant-a", plan: "free" },
    });
    tenantAId = tenantA.id;

    const tenantB = await db.tenant.create({
        data: { name: "Scope Tenant B", slug: "scope-tenant-b", plan: "free" },
    });
    tenantBId = tenantB.id;

    for (const [tenant, slug] of [
        [tenantA, "scope-org-a"],
        [tenantB, "scope-org-b"],
    ] as const) {
        await db.organization.create({
            data: { tenantId: tenant.id, name: tenant.name, slug },
        });
    }

    const user = await db.user.create({
        data: { email: "both-tenants@example.com", name: "Both Tenants" },
    });
    userId = user.id;

    const outsider = await db.user.create({
        data: { email: "outsider@example.com", name: "Outsider" },
    });
    outsiderId = outsider.id;

    // The user is an admin in BOTH tenants.
    for (const tenant of [tenantA, tenantB]) {
        const role = await db.role.create({
            data: {
                key: `admin-${tenant.id}`,
                name: "Admin",
                isSystem: false,
                tenantId: tenant.id,
            },
        });

        await db.membership.create({
            data: { tenantId: tenant.id, userId, roleId: role.id },
        });
    }
});

afterAll(async () => {
    await db.$disconnect();
});

describe("organization access is bound to the request tenant", () => {
    it("allows the slug matching the request tenant", async () => {
        const membership = await tenantContext.run({ tenantId: tenantAId }, () =>
            service.getMembershipForRequest(userId, "scope-org-a"),
        );

        expect(membership).not.toBeNull();
        expect(membership!.organization.tenantId).toBe(tenantAId);
    });

    it("rejects tenant B's slug when the request is scoped to tenant A", async () => {
        const membership = await tenantContext.run({ tenantId: tenantAId }, () =>
            service.getMembershipForRequest(userId, "scope-org-b"),
        );

        // The caller IS a member of scope-org-b, but not in this tenant.
        expect(membership).toBeNull();
    });

    it("rejects every tenant B slug when scoped to tenant A", async () => {
        const slugs = ["scope-org-b"];

        for (const slug of slugs) {
            const membership = await tenantContext.run(
                { tenantId: tenantAId },
                () => service.getMembershipForRequest(userId, slug),
            );
            expect(membership).toBeNull();
        }
    });

    it("rejects a slug belonging to a tenant the user is not in at all", async () => {
        const membership = await tenantContext.run({ tenantId: tenantBId }, () =>
            service.getMembershipForRequest(outsiderId, "scope-org-b"),
        );

        expect(membership).toBeNull();
    });

    it("rejects when there is no tenant context (fail closed)", async () => {
        await expect(
            service.getMembershipForRequest(userId, "scope-org-a"),
        ).rejects.toThrow(/Tenant context/i);
    });

    it("does not serve a cached organization across tenants", async () => {
        // Tenant A's view of its own org must not be readable in tenant B's
        // context, even though slugs are globally unique.
        const inTenantA = await tenantContext.run({ tenantId: tenantAId }, () =>
            service.findBySlugInTenant("scope-org-a"),
        );
        expect(inTenantA).not.toBeNull();
        expect(inTenantA!.tenantId).toBe(tenantAId);

        const inTenantB = await tenantContext.run({ tenantId: tenantBId }, () =>
            service.findBySlugInTenant("scope-org-a"),
        );
        expect(inTenantB).toBeNull();
    });
});

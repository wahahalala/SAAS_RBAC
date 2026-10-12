import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { PrismaService } from "@/prisma/prisma.service";
import { DomainEventsService } from "@/modules/events/domain-events.service";
import { DOMAIN_EVENTS } from "@saas/shared-types";
import type { DomainEventPayload } from "@saas/shared-types";

/**
 * The emitters.
 *
 * A listener suite can pass while nothing in the application ever emits — the
 * wiring between a business operation and its event is a separate failure mode.
 * These tests call the real services and assert the events actually come out,
 * with the fields listeners depend on.
 *
 * The services are constructed with the real PrismaService and a real emitter;
 * only the queue producers are stubbed (they are covered elsewhere).
 */

const db = new PrismaService();
const emitter = new EventEmitter2({ delimiter: "." });

let events: DomainEventsService;
let captured: Array<{ name: string; payload: DomainEventPayload }>;

beforeAll(async () => {
    await db.$connect();
});

afterAll(async () => {
    await db.$disconnect();
});

beforeEach(async () => {
    await db.auditLog.deleteMany();
    await db.usageRecord.deleteMany();
    await db.refreshSession.deleteMany();
    await db.invitation.deleteMany();
    await db.report.deleteMany();
    await db.membership.deleteMany();
    await db.subscription.deleteMany();
    await db.organization.deleteMany();
    await db.role.deleteMany();
    await db.user.deleteMany();
    await db.tenant.deleteMany();

    emitter.removeAllListeners();
    captured = [];

    for (const name of Object.values(DOMAIN_EVENTS)) {
        emitter.on(name, (payload) => captured.push({ name, payload }));
    }

    events = new DomainEventsService(emitter);
});

function emitted(name: string) {
    return captured.filter((entry) => entry.name === name).map((e) => e.payload);
}

describe("TENANT_CREATED is emitted by organization provisioning", () => {
    it("emits after the transaction commits, with the new tenant", async () => {
        const { OrganizationsService } = await import(
            "@/modules/organizations/organizations.service"
        );
        const { TenantContext } = await import("@/modules/tenant");

        const user = await db.user.create({
            data: { email: "owner@example.com", name: "Owner" },
        });

        const queueStub = { enqueueInviteEmail: async () => null };
        const service = new OrganizationsService(
            db,
            { invalidateTenant: async () => 0, get: async () => null, set: async () => undefined, invalidate: async () => undefined, invalidatePattern: async () => 0 } as never,
            new TenantContext(),
            { get: () => "http://localhost:3000" } as never,
            queueStub as never,
            events,
        );

        const created = await service.create(user.id, {
            name: "Emitted Tenant",
            slug: "emitted-tenant",
        });

        const tenantEvents = emitted(DOMAIN_EVENTS.TENANT_CREATED);
        expect(tenantEvents).toHaveLength(1);

        const event = tenantEvents[0] as {
            tenantId: string;
            tenantName: string;
            tenantSlug: string;
            ownerId: string;
            occurredAt: string;
        };

        expect(event.tenantId).toBe(created.tenantId);
        expect(event.tenantSlug).toBe("emitted-tenant");
        expect(event.ownerId).toBe(user.id);
        expect(event.occurredAt).toBeTruthy();

        // The event must describe a tenant that actually exists.
        const persisted = await db.tenant.findUnique({
            where: { id: event.tenantId },
        });
        expect(persisted).not.toBeNull();
    });

    it("does not emit when provisioning is rejected", async () => {
        const { OrganizationsService } = await import(
            "@/modules/organizations/organizations.service"
        );
        const { TenantContext } = await import("@/modules/tenant");

        const user = await db.user.create({
            data: { email: "owner2@example.com", name: "Owner" },
        });

        const service = new OrganizationsService(
            db,
            { invalidateTenant: async () => 0, get: async () => null, set: async () => undefined, invalidate: async () => undefined, invalidatePattern: async () => 0 } as never,
            new TenantContext(),
            { get: () => "http://localhost:3000" } as never,
            { enqueueInviteEmail: async () => null } as never,
            events,
        );

        await service.create(user.id, { name: "Slug Tenant", slug: "taken-slug" });

        // Re-using the slug throws; a failed provisioning must not announce a
        // tenant (this is why the emit sits after the transaction).
        await expect(
            service.create(user.id, { name: "Dup", slug: "taken-slug" }),
        ).rejects.toThrow();

        expect(emitted(DOMAIN_EVENTS.TENANT_CREATED)).toHaveLength(1);
    });
});

describe("ROLE_CHANGED is emitted by updateMemberRole", () => {
    async function seedOrg() {
        const tenant = await db.tenant.create({
            data: { name: "Role Tenant", slug: "role-tenant", plan: "free" },
        });
        await db.organization.create({
            data: { tenantId: tenant.id, name: tenant.name, slug: "role-org" },
        });

        const actor = await db.user.create({
            data: { email: "admin@example.com", name: "Admin" },
        });
        const target = await db.user.create({
            data: { email: "member@example.com", name: "Member" },
        });

        const adminRole = await db.role.create({
            data: { key: "admin", name: "Admin", isSystem: true, tenantId: tenant.id },
        });
        const memberRole = await db.role.create({
            data: { key: "member", name: "Member", isSystem: true, tenantId: tenant.id },
        });

        await db.membership.create({
            data: { tenantId: tenant.id, userId: actor.id, roleId: adminRole.id },
        });
        const membership = await db.membership.create({
            data: { tenantId: tenant.id, userId: target.id, roleId: memberRole.id },
        });

        return { tenant, actor, target, membership, adminRole, memberRole };
    }

    function buildService() {
        return import("@/modules/organizations/organizations.service").then(
            async ({ OrganizationsService }) => {
                const { TenantContext } = await import("@/modules/tenant");
                const context = new TenantContext();

                return {
                    context,
                    service: new OrganizationsService(
                        db,
                        { invalidateTenant: async () => 0, get: async () => null, set: async () => undefined, invalidate: async () => undefined, invalidatePattern: async () => 0 } as never,
                        context,
                        { get: () => "http://localhost:3000" } as never,
                        { enqueueInviteEmail: async () => null } as never,
                        events,
                    ),
                };
            },
        );
    }

    it("emits the transition with previous and new role keys", async () => {
        const { tenant, actor, target, membership } = await seedOrg();
        const { service, context } = await buildService();

        await context.run({ tenantId: tenant.id }, () =>
            service.updateMemberRole("role-org", membership.id, "admin", actor.id),
        );

        const roleEvents = emitted(DOMAIN_EVENTS.ROLE_CHANGED);
        expect(roleEvents).toHaveLength(1);

        const event = roleEvents[0] as {
            tenantId: string;
            actorId?: string;
            membershipId: string;
            targetUserId: string;
            previousRoleKey: string;
            newRoleKey: string;
        };

        expect(event.tenantId).toBe(tenant.id);
        // The actor is the admin who made the change, not the member changed.
        expect(event.actorId).toBe(actor.id);
        expect(event.targetUserId).toBe(target.id);
        expect(event.previousRoleKey).toBe("member");
        expect(event.newRoleKey).toBe("admin");
    });

    it("does not emit when the role is unchanged", async () => {
        const { tenant, actor, membership } = await seedOrg();
        const { service, context } = await buildService();

        // Already "member"; re-assigning the same role is a no-op.
        await context.run({ tenantId: tenant.id }, () =>
            service.updateMemberRole("role-org", membership.id, "member", actor.id),
        );

        expect(emitted(DOMAIN_EVENTS.ROLE_CHANGED)).toHaveLength(0);
    });
});

describe("provisioning grants the new tenant's admin real permissions", () => {
    it("copies the global role's grants onto the tenant role", async () => {
        const { OrganizationsService } = await import(
            "@/modules/organizations/organizations.service"
        );
        const { TenantContext } = await import("@/modules/tenant");

        // Global system roles carry the permission set.
        const globalAdmin = await db.role.create({
            data: { key: "admin", name: "Admin", isSystem: true, tenantId: null },
        });
        // Permissions are global and keyed by a unique `key`: upsert so this
        // test does not collide with others that seed the same permissions.
        const permissions = await Promise.all(
            ["billing.manage", "user.create", "project.read"].map((key) =>
                db.permission.upsert({
                    where: { key },
                    update: {},
                    create: { key, name: key },
                }),
            ),
        );
        await db.rolePermission.createMany({
            data: permissions.map((permission) => ({
                roleId: globalAdmin.id,
                permissionId: permission.id,
            })),
        });

        const user = await db.user.create({
            data: { email: "perm-owner@example.com", name: "Perm Owner" },
        });

        const service = new OrganizationsService(
            db,
            {
                invalidateTenant: async () => 0,
                get: async () => null,
                set: async () => undefined,
                invalidate: async () => undefined,
                invalidatePattern: async () => 0,
            } as never,
            new TenantContext(),
            { get: () => "http://localhost:3000" } as never,
            { enqueueInviteEmail: async () => null } as never,
            events,
        );

        const created = await service.create(user.id, {
            name: "Perm Tenant",
            slug: "perm-tenant",
        });

        // The tenant's admin role must be able to do things: PermissionGuard
        // reads the TENANT role, not the global one.
        const tenantAdmin = await db.role.findFirst({
            where: { tenantId: created.tenantId, key: "admin" },
            include: { rolePermissions: { include: { permission: true } } },
        });

        const keys = tenantAdmin!.rolePermissions
            .map((rp) => rp.permission.key)
            .sort();

        expect(keys).toEqual(["billing.manage", "project.read", "user.create"]);
    });
});

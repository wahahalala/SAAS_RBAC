import { INestApplication } from "@nestjs/common";
import { PrismaService } from "@/prisma/prisma.service";
import { createApp } from "@/main";
import * as bcrypt from "bcrypt";
import request from "supertest";

/**
 * Shared harness for the end-to-end API suite.
 *
 * One Nest application is created per spec FILE (in `beforeAll`) and closed in
 * `afterAll`. The database is truncated and re-seeded per TEST, so each test
 * starts from the same two-tenant world without leaking state into the next.
 */

export interface E2eWorld {
    app: INestApplication;
    prisma: PrismaService;
    http: ReturnType<typeof request>;
    tenantAId: string;
    tenantBId: string;
    /** admin@example.com, member of tenant A with full permissions. */
    adminUser: { id: string; email: string };
    /** member@example.com, member of tenant A with NO permissions. */
    memberUser: { id: string; email: string };
    /** outsider@example.com, member of tenant B only. */
    outsiderUser: { id: string; email: string };
    adminToken: string;
    memberToken: string;
    outsiderToken: string;
}

export async function createWorld(): Promise<E2eWorld> {
    const app = await createApp();
    await app.init();

    const prisma = app.get(PrismaService);
    const http = request(app.getHttpServer());

    return {
        app,
        prisma,
        http,
        tenantAId: "",
        tenantBId: "",
        adminUser: { id: "", email: "" },
        memberUser: { id: "", email: "" },
        outsiderUser: { id: "", email: "" },
        adminToken: "",
        memberToken: "",
        outsiderToken: "",
    };
}

/**
 * Truncate every business table and seed the standard three-user, two-tenant
 * world the assertions depend on.
 */
export async function resetWorld(world: E2eWorld): Promise<void> {
    await world.prisma.cleanDatabase();

    // Tenants.
    const tenantA = await world.prisma.tenant.create({
        data: { name: "Tenant A", slug: "tenant-a", plan: "free" },
    });
    const tenantB = await world.prisma.tenant.create({
        data: { name: "Tenant B", slug: "tenant-b", plan: "free" },
    });

    world.tenantAId = tenantA.id;
    world.tenantBId = tenantB.id;

    // Organization rows (1:1 with tenants): routes address them by slug.
    await world.prisma.organization.create({
        data: { tenantId: tenantA.id, name: tenantA.name, slug: "tenant-a" },
    });
    await world.prisma.organization.create({
        data: { tenantId: tenantB.id, name: tenantB.name, slug: "tenant-b" },
    });

    // Global permissions.
    const permissionKeys = [
        "user.create",
        "user.delete",
        "project.read",
        "project.create",
        "project.update",
        "billing.manage",
        "audit.read",
    ];

    const permissions: Record<string, string> = {};
    for (const key of permissionKeys) {
        const permission = await world.prisma.permission.upsert({
            where: { key },
            update: {},
            create: { key, name: key },
        });
        permissions[key] = permission.id;
    }

    // Roles: admin (full) and member (none) in tenant A; admin in tenant B.
    const adminRoleA = await world.prisma.role.create({
        data: { key: "admin", name: "Admin", isSystem: true, tenantId: tenantA.id },
    });
    const memberRoleA = await world.prisma.role.create({
        data: { key: "member", name: "Member", isSystem: true, tenantId: tenantA.id },
    });
    const adminRoleB = await world.prisma.role.create({
        data: { key: "admin", name: "Admin", isSystem: true, tenantId: tenantB.id },
    });

    for (const permissionId of Object.values(permissions)) {
        await world.prisma.rolePermission.create({
            data: { roleId: adminRoleA.id, permissionId },
        });
        await world.prisma.rolePermission.create({
            data: { roleId: adminRoleB.id, permissionId },
        });
    }

    const passwordHash = await bcrypt.hash(PASSWORD, 12);

    // Users + memberships.
    const admin = await world.prisma.user.create({
        data: { email: "admin@example.com", passwordHash, name: "Admin" },
    });
    world.adminUser = { id: admin.id, email: admin.email };
    await world.prisma.membership.create({
        data: { tenantId: tenantA.id, userId: admin.id, roleId: adminRoleA.id },
    });

    const member = await world.prisma.user.create({
        data: { email: "member@example.com", passwordHash, name: "Member" },
    });
    world.memberUser = { id: member.id, email: member.email };
    await world.prisma.membership.create({
        data: { tenantId: tenantA.id, userId: member.id, roleId: memberRoleA.id },
    });

    const outsider = await world.prisma.user.create({
        data: { email: "outsider@example.com", passwordHash, name: "Outsider" },
    });
    world.outsiderUser = { id: outsider.id, email: outsider.email };
    await world.prisma.membership.create({
        data: { tenantId: tenantB.id, userId: outsider.id, roleId: adminRoleB.id },
    });

    // Mint a token for each by logging in through the REAL endpoint.
    world.adminToken = await loginAndGetToken(world.http, "admin@example.com");
    world.memberToken = await loginAndGetToken(world.http, "member@example.com");
    world.outsiderToken = await loginAndGetToken(world.http, "outsider@example.com");
}

const PASSWORD = "TestPass123!";

/** Login as a seeded user, returning the access token. */
async function loginAndGetToken(
    http: E2eWorld["http"],
    email: string,
): Promise<string> {
    const login = await http
        .post("/api/v1/auth/login")
        .send({ email, password: PASSWORD })
        .expect(200);

    return login.body.accessToken as string;
}

export { PASSWORD };

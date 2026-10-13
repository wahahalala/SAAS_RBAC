import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

// System-level permissions (tenant-agnostic).
const DEFAULT_PERMISSIONS = [
    { key: "user.create", name: "Create users" },
    { key: "user.delete", name: "Delete users" },
    { key: "project.read", name: "Read projects" },
    { key: "project.create", name: "Create projects" },
    { key: "project.update", name: "Update projects" },
    { key: "billing.manage", name: "Manage billing" },
    // Reading the tenant's audit trail is an administrator capability: it
    // exposes who did what across the whole tenant.
    { key: "audit.read", name: "Read audit logs" },
];

const ADMIN_PERMISSION_KEYS = DEFAULT_PERMISSIONS.map((p) => p.key);

async function seedPermissions() {
    const permissions = [];
    for (const p of DEFAULT_PERMISSIONS) {
        const permission = await prisma.permission.upsert({
            where: { key: p.key },
            update: {},
            create: p,
        });
        permissions.push(permission);
    }
    return permissions;
}

async function main() {
    const email = "admin@example.com";
    const password = "Admin123!";
    const passwordHash = await bcrypt.hash(password, 12);

    // 1. Default permissions (global)
    const permissions = await seedPermissions();
    const adminPermissions = permissions.filter((p) =>
        ADMIN_PERMISSION_KEYS.includes(p.key)
    );

    // 2. System roles (global, tenantId = null).
    //    NOTE: because tenantId is nullable, we use findFirst + create instead
    //    of a compound-unique upsert (nullable columns in compound uniques are
    //    a known Prisma/Postgres footgun).
    let adminRole = await prisma.role.findFirst({
        where: { key: "admin", tenantId: null },
    });
    if (!adminRole) {
        adminRole = await prisma.role.create({
            data: {
                key: "admin",
                name: "Admin",
                description: "Full tenant access",
                isSystem: true,
            },
        });
    }

    const existingMemberRole = await prisma.role.findFirst({
        where: { key: "member", tenantId: null },
    });
    if (!existingMemberRole) {
        await prisma.role.create({
            data: {
                key: "member",
                name: "Member",
                description: "Standard member access",
                isSystem: true,
            },
        });
    }

    // Link default permissions to the admin role (idempotent).
    for (const permission of adminPermissions) {
        await prisma.rolePermission.upsert({
            where: {
                roleId_permissionId: {
                    roleId: adminRole.id,
                    permissionId: permission.id,
                },
            },
            update: {},
            create: {
                roleId: adminRole.id,
                permissionId: permission.id,
            },
        });
    }

    // 3. Default tenant
    const tenant = await prisma.tenant.upsert({
        where: { slug: "default" },
        update: {},
        create: {
            name: "Default Tenant",
            slug: "default",
            plan: "free",
            status: "active",
        },
    });

    // 4. Legacy organization (compatibility, 1:1 with the default tenant)
    await prisma.organization.upsert({
        where: { tenantId: tenant.id },
        update: {},
        create: {
            tenantId: tenant.id,
            name: tenant.name,
            slug: tenant.slug,
        },
    });

    // 5. Default admin user
    const user = await prisma.user.upsert({
        where: { email },
        update: { passwordHash },
        create: {
            email,
            name: "Admin User",
            passwordHash,
            emailVerified: new Date(),
        },
    });

    // 6. Membership linking the admin user to the default tenant + admin role
    await prisma.membership.upsert({
        where: {
            tenantId_userId: {
                tenantId: tenant.id,
                userId: user.id,
            },
        },
        update: { roleId: adminRole.id },
        create: {
            tenantId: tenant.id,
            userId: user.id,
            roleId: adminRole.id,
        },
    });

    // 7. Keep EXISTING tenant roles in step with the global definitions.
    //
    //    A tenant role is created once (with a copy of the global grants at
    //    that moment). Without this step a permission added here later — like
    //    `audit.read` — would reach the global role and any NEW tenant, but
    //    never an already-provisioned tenant, leaving its admin unable to use
    //    the new capability. Idempotent by design.
    const tenantAdminRoles = await prisma.role.findMany({
        where: { key: "admin", tenantId: { not: null } },
        select: { id: true },
    });

    let syncedGrants = 0;
    for (const role of tenantAdminRoles) {
        for (const permission of adminPermissions) {
            const existingGrant = await prisma.rolePermission.findUnique({
                where: {
                    roleId_permissionId: {
                        roleId: role.id,
                        permissionId: permission.id,
                    },
                },
            });

            if (!existingGrant) {
                await prisma.rolePermission.create({
                    data: { roleId: role.id, permissionId: permission.id },
                });
                syncedGrants += 1;
            }
        }
    }

    console.log("Seed completed ✔");
    console.log(`  Tenant roles synced: ${tenantAdminRoles.length} role(s), +${syncedGrants} grant(s)`);
    console.log(`  Tenant:      ${tenant.name} (${tenant.slug})`);
    console.log(`  Admin user:  ${email} / ${password}`);
    console.log(`  Admin role:  ${adminRole.key}`);
    console.log(`  Permissions: ${adminPermissions.length}`);
}

main()
    .catch((error) => {
        console.error("Seed failed:", error);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });

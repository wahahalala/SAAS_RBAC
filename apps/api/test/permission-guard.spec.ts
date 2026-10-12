import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "@/prisma/prisma.service";
import { PermissionGuard } from "@/common/guards/permission.guard";
import { CacheService } from "@/modules/redis/cache.service";

const db = new PrismaService();
const reflector = new Reflector();

/**
 * PermissionGuard resolves (and caches in Redis) the caller's effective
 * permissions. Use a small in-memory stub so this RBAC integration test stays
 * independent of a running Redis instance; the cache contract exercised here
 * is only get/set.
 */
function createCacheServiceStub(): CacheService {
    const store = new Map<string, unknown>();

    return {
        get: async (key: string) => (store.has(key) ? store.get(key) : null),
        set: async (key: string, value: unknown) => {
            store.set(key, value);
        },
        invalidate: async (key: string) => {
            store.delete(key);
        },
        invalidatePattern: async () => 0,
        invalidateTenant: async () => 0,
    } as unknown as CacheService;
}

let guard: PermissionGuard;

beforeEach(() => {
    guard = new PermissionGuard(reflector, db, createCacheServiceStub());
});

function buildContext(permissionKey: string, userId: string, tenantId: string) {
    // Minimal ExecutionContext stub sufficient for PermissionGuard.
    const handler = () => {};
    Reflect.defineMetadata("requiredPermissions", [permissionKey], handler);

    return {
        getHandler: () => handler,
        getClass: () => ({}),
        switchToHttp: () => ({
            getRequest: () => ({
                user: { id: userId },
                tenantId,
            }),
        }),
    } as any;
}

let tenantAId!: string;
let adminUserId!: string;
let adminRoleId!: string;
let projectReadId!: string;
let projectCreateId!: string;

beforeAll(async () => {
    await db.$connect();
    await db.cleanDatabase();

    // Tenant A + admin role + membership.
    const tenant = await db.tenant.create({
        data: { name: "RBAC Tenant A", slug: "rbac-tenant-a", plan: "free" },
    });
    tenantAId = tenant.id;

    const user = await db.user.create({
        data: { email: "rbac-admin@example.com", name: "RBAC Admin" },
    });
    adminUserId = user.id;

    const role = await db.role.create({
        data: { key: "rbac-admin", name: "RBAC Admin", isSystem: false, tenantId: tenant.id },
    });
    adminRoleId = role.id;

    await db.membership.create({
        data: { tenantId: tenant.id, userId: user.id, roleId: role.id },
    });

    // Permissions: only project.read (NOT project.create).
    const read = await db.permission.create({
        data: { key: "project.read", name: "Read projects" },
    });
    projectReadId = read.id;

    const create = await db.permission.create({
        data: { key: "project.create", name: "Create projects" },
    });
    projectCreateId = create.id;

    await db.rolePermission.create({
        data: { roleId: role.id, permissionId: read.id },
    });
});

afterAll(async () => {
    await db.$disconnect();
});

describe("PermissionGuard (RBAC)", () => {
    it("allows access when the user holds the required permission", async () => {
        const ctx = buildContext("project.read", adminUserId, tenantAId);
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
    });

    it("denies access when the user lacks the required permission", async () => {
        const ctx = buildContext("project.create", adminUserId, tenantAId);
        await expect(guard.canActivate(ctx)).rejects.toThrow(
            /Requires one of these permissions/,
        );
    });
});

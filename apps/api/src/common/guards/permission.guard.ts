import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "@/prisma/prisma.service";
import { CacheService } from "@/modules/redis/cache.service";
import { RedisKeys } from "@/modules/redis/keys";
import { PERMISSIONS_KEY } from "../decorators/permission.decorator";

const PERMISSION_CACHE_TTL_SECONDS = 300;

/**
 * PermissionGuard resolves the caller's effective permissions from
 * Membership -> Role -> RolePermission -> Permission (scoped to the current
 * tenant, resolved by TenantGuard) and enforces @RequirePermission(...).
 *
 * The resolved permission set is cached in Redis under
 * `tenant:{tenantId}:user:{userId}:permissions`; invalidation happens via
 * CacheService.invalidateTenant(tenantId) whenever roles/permissions change.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
            PERMISSIONS_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (!requiredPermissions || requiredPermissions.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;
        const tenantId = request.tenantId;

        if (!user) {
            throw new ForbiddenException("User not authenticated");
        }

        if (!tenantId) {
            throw new ForbiddenException("Tenant context is required");
        }

        const cacheKey = RedisKeys.permissions(tenantId, user.id);
        let granted = await this.cacheService.get<string[]>(cacheKey);

        if (!granted || granted.length === 0) {
            granted = await this.resolvePermissions(tenantId, user.id);
            await this.cacheService.set(
                cacheKey,
                granted,
                PERMISSION_CACHE_TTL_SECONDS,
            );
        }

        const hasPermission = requiredPermissions.some((p) =>
            granted!.includes(p),
        );

        if (!hasPermission) {
            throw new ForbiddenException(
                `Requires one of these permissions: ${requiredPermissions.join(", ")}`,
            );
        }

        request.grantedPermissions = granted;
        return true;
    }

    private async resolvePermissions(
        tenantId: string,
        userId: string,
    ): Promise<string[]> {
        const membership = await this.prisma.membership.findUnique({
            where: {
                tenantId_userId: { tenantId, userId },
            },
            include: {
                role: {
                    include: {
                        rolePermissions: {
                            include: { permission: true },
                        },
                    },
                },
            },
        });

        if (!membership) {
            throw new ForbiddenException("Not a member of this tenant");
        }

        return membership.role.rolePermissions.map((rp) => rp.permission.key);
    }
}

import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
    UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PrismaService } from "@/prisma/prisma.service";
import { IS_PUBLIC_KEY } from "@/common/decorators/public.decorator";
import { SKIP_TENANT_CHECK } from "./skip-tenant-check.decorator";

/**
 * Tenant isolation guard.
 *
 * Order of operations:
 *   1. Skip public routes and routes explicitly marked @SkipTenantCheck().
 *   2. Require an authenticated user (set by JwtAuthGuard).
 *   3. Read the tenantId from the `X-Tenant-Id` header. The request body /
 *      query can NOT override this — headers come from the client but are
 *      never merged with user-supplied DTO data.
 *   4. Verify the user has a Membership in that tenant.
 *   5. Store the resolved tenantId on the request. The TenantInterceptor then
 *      wraps the handler in the AsyncLocalStorage context so the Prisma client
 *      extension can inject `where.tenantId` automatically.
 */
@Injectable()
export class TenantGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        const skipTenant = this.reflector.getAllAndOverride<boolean>(
            SKIP_TENANT_CHECK,
            [context.getHandler(), context.getClass()],
        );

        if (isPublic || skipTenant) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new UnauthorizedException("Authentication required");
        }

        const tenantId = request.headers["x-tenant-id"] as string | undefined;

        if (!tenantId) {
            throw new ForbiddenException("X-Tenant-Id header is required");
        }

        // Verify membership in the tenant (tenantId can never come from body/query).
        const membership = await this.prisma.membership.findUnique({
            where: {
                tenantId_userId: {
                    tenantId,
                    userId: user.id,
                },
            },
            select: { tenantId: true, roleId: true },
        });

        if (!membership) {
            throw new ForbiddenException(
                "You are not a member of this tenant",
            );
        }

        // Expose the resolved tenantId on the request (never from user input).
        // The TenantInterceptor then wraps the request in the tenant context.
        request.tenantId = tenantId;
        request.tenantMembership = membership;

        return true;
    }
}

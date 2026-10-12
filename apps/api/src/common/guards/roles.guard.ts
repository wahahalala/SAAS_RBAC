import {
    Injectable,
    CanActivate,
    ExecutionContext,
    ForbiddenException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Role } from "@saas/shared";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Roles Guard
 * Checks if the user has the required role to access a route
 */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private reflector: Reflector) { }

    canActivate(context: ExecutionContext): boolean {
        const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);

        // If no roles are required, allow access
        if (!requiredRoles || requiredRoles.length === 0) {
            return true;
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user;

        if (!user) {
            throw new ForbiddenException("User not authenticated");
        }

        // Check if user has the required role in the current organization
        const membership = request.organizationMember;

        if (!membership) {
            throw new ForbiddenException("Not a member of this organization");
        }

        const hasRole = requiredRoles.some((role) => membership.role === role);

        if (!hasRole) {
            throw new ForbiddenException(
                `Requires one of these roles: ${requiredRoles.join(", ")}`
            );
        }

        return true;
    }
}

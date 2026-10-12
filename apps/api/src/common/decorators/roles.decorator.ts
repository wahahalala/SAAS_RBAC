import { SetMetadata } from "@nestjs/common";
import { Role } from "@saas/shared";

export const ROLES_KEY = "roles";

/**
 * Require specific roles to access a route
 * @example
 * @Roles('admin')
 * @Delete(':id')
 * deleteUser(@Param('id') id: string) {
 *   return this.usersService.delete(id);
 * }
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);

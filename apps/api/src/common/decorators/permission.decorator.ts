import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "requiredPermissions";

/**
 * Require the caller to hold one or more permissions (OR semantics).
 *
 * @example
 * @RequirePermission("project.create")
 * @Post("projects")
 * create() { ... }
 *
 * @example
 * @RequirePermission("billing.manage")
 * @Get("billing")
 * list() { ... }
 */
export const RequirePermission = (...permissions: string[]) =>
    SetMetadata(PERMISSIONS_KEY, permissions);

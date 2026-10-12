import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Extract the current tenantId resolved by TenantGuard.
 *
 * @example
 * @Get('items')
 * list(@CurrentTenantId() tenantId: string) { ... }
 */
export const CurrentTenantId = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        return (request as { tenantId?: string }).tenantId;
    },
);

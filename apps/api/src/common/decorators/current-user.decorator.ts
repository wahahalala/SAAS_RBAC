import { createParamDecorator, ExecutionContext } from "@nestjs/common";

/**
 * Get the current authenticated user from the request
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
    (data: string | undefined, ctx: ExecutionContext) => {
        const request = ctx.switchToHttp().getRequest();
        const user = request.user;

        // If a specific property is requested, return that
        if (data) {
            return user?.[data];
        }

        return user;
    }
);

import {
    Controller,
    Get,
    Post,
    Param,
    HttpCode,
    HttpStatus,
} from "@nestjs/common";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from "@nestjs/swagger";
import { InvitationsService } from "./invitations.service";
import { CurrentUser, Public } from "@/common/decorators";
import { SkipTenantCheck } from "@/modules/tenant";

interface AuthUser {
    id: string;
    email: string;
}

/**
 * Invitation accept flow.
 *
 * Every route here is `@SkipTenantCheck()`: the token IS the tenant selector,
 * and the accept page must work before the caller has an active tenant (the
 * web client attaches `X-Tenant-Id` from localStorage, which a brand-new user
 * does not have yet). TenantGuard would otherwise reject with 403.
 *
 * The admin-side routes (issue / list / revoke) live under
 * `/organizations/:slug/invitations`, where the tenant scope is meaningful.
 */
@ApiTags("Invitations")
@Controller("invitations")
@SkipTenantCheck()
export class InvitationsController {
    constructor(private readonly invitationsService: InvitationsService) {}

    @Public()
    @Get(":token")
    @ApiOperation({ summary: "Public preview of an invitation" })
    @ApiResponse({ status: 200, description: "Invitation preview" })
    @ApiResponse({ status: 404, description: "Invitation not found" })
    async preview(@Param("token") token: string) {
        return this.invitationsService.preview(token);
    }

    @Post(":token/accept")
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Accept an invitation and join the organization" })
    @ApiResponse({ status: 200, description: "Invitation accepted" })
    @ApiResponse({ status: 409, description: "Invitation expired or canceled" })
    async accept(
        @Param("token") token: string,
        @CurrentUser() user: AuthUser,
    ) {
        return this.invitationsService.accept(token, user.id);
    }
}

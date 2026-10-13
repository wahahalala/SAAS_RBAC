import {
    Controller,
    Get,
    Patch,
    Delete,
    Body,
    HttpCode,
    HttpStatus,
    Req,
} from "@nestjs/common";
import type { Request } from "express";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from "@nestjs/swagger";
import { UsersService } from "./users.service";
import { UpdateUserDto } from "./dto";
import { CurrentUser } from "@/common/decorators";
import { SkipTenantCheck } from "@/modules/tenant";

interface AuthUser {
    id: string;
    email: string;
    name: string | null;
}

@ApiTags("Users")
@ApiBearerAuth()
@Controller("users")
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Get("me")
    @SkipTenantCheck()
    @ApiOperation({ summary: "Get current user profile" })
    @ApiResponse({ status: 200, description: "User profile" })
    async getProfile(@CurrentUser() user: AuthUser) {
        return this.usersService.findById(user.id);
    }

    @Patch("me")
    @SkipTenantCheck()
    @ApiOperation({ summary: "Update current user profile" })
    @ApiResponse({ status: 200, description: "Updated user profile" })
    async updateProfile(
        @CurrentUser() user: AuthUser,
        @Body() dto: UpdateUserDto
    ) {
        return this.usersService.update(user.id, dto);
    }

    @Get("me/organizations")
    @SkipTenantCheck()
    @ApiOperation({ summary: "Get organizations the user belongs to" })
    @ApiResponse({ status: 200, description: "List of organizations" })
    async getOrganizations(@CurrentUser() user: AuthUser) {
        return this.usersService.getOrganizations(user.id);
    }

    @Delete("me")
    @SkipTenantCheck()
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: "Delete current user account" })
    @ApiResponse({ status: 204, description: "Account deleted" })
    async deleteAccount(@CurrentUser() user: AuthUser, @Req() req: Request) {
        // Request metadata rides along so the DELETE_USER audit row can record
        // where the deletion came from.
        await this.usersService.delete(user.id, requestMeta(req));
    }
}

/** Extract the request metadata the audit trail records. */
function requestMeta(req: Request): { ipAddress?: string; userAgent?: string } {
    return {
        ipAddress:
            req.ip ||
            (req.headers["x-forwarded-for"] as string)?.split(",")[0],
        userAgent: req.headers["user-agent"],
    };
}

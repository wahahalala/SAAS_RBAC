import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    HttpCode,
    HttpStatus,
    ForbiddenException,
    NotFoundException,
} from "@nestjs/common";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
} from "@nestjs/swagger";
import { OrganizationsService } from "./organizations.service";
import {
    CreateOrganizationDto,
    UpdateOrganizationDto,
    InviteMemberDto,
    UpdateMemberRoleDto,
} from "./dto";
import { CurrentUser } from "@/common/decorators";
import { SkipTenantCheck } from "@/modules/tenant";

interface AuthUser {
    id: string;
    email: string;
}

@ApiTags("Organizations")
@ApiBearerAuth()
@Controller("organizations")
export class OrganizationsController {
    constructor(private readonly organizationsService: OrganizationsService) { }

    @Post()
    @SkipTenantCheck()
    @ApiOperation({ summary: "Create a new organization" })
    @ApiResponse({ status: 201, description: "Organization created" })
    async create(
        @CurrentUser() user: AuthUser,
        @Body() dto: CreateOrganizationDto
    ) {
        return this.organizationsService.create(user.id, dto);
    }

    @Get(":slug")
    @ApiOperation({ summary: "Get organization by slug" })
    @ApiResponse({ status: 200, description: "Organization details" })
    @ApiResponse({ status: 404, description: "Organization not found" })
    async findBySlug(
        @CurrentUser() user: AuthUser,
        @Param("slug") slug: string
    ) {
        // getMembership resolves the slug WITHIN the tenant TenantGuard
        // authorised for this request, so a slug from another tenant is a miss.
        const membership = await this.organizationsService.getMembership(
            user.id,
            slug
        );
        if (!membership) {
            throw new NotFoundException("Organization not found");
        }

        return this.organizationsService.findBySlug(slug);
    }

    @Patch(":slug")
    @ApiOperation({ summary: "Update organization" })
    @ApiResponse({ status: 200, description: "Organization updated" })
    async update(
        @CurrentUser() user: AuthUser,
        @Param("slug") slug: string,
        @Body() dto: UpdateOrganizationDto
    ) {
        // Verify user is admin
        const membership = await this.organizationsService.getMembership(
            user.id,
            slug
        );
        if (!membership || membership.role !== "admin") {
            throw new ForbiddenException("Admin access required");
        }

        return this.organizationsService.update(slug, dto);
    }

    @Delete(":slug")
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: "Delete organization" })
    @ApiResponse({ status: 204, description: "Organization deleted" })
    async delete(
        @CurrentUser() user: AuthUser,
        @Param("slug") slug: string
    ) {
        // Verify user is admin
        const membership = await this.organizationsService.getMembership(
            user.id,
            slug
        );
        if (!membership || membership.role !== "admin") {
            throw new ForbiddenException("Admin access required");
        }

        await this.organizationsService.delete(slug);
    }

    // Members management
    @Get(":slug/members")
    @ApiOperation({ summary: "Get organization members" })
    @ApiResponse({ status: 200, description: "List of members" })
    async getMembers(
        @CurrentUser() user: AuthUser,
        @Param("slug") slug: string
    ) {
        // Verify user is a member
        const membership = await this.organizationsService.getMembership(
            user.id,
            slug
        );
        if (!membership) {
            throw new ForbiddenException("Not a member of this organization");
        }

        return this.organizationsService.getMembers(slug);
    }

    @Post(":slug/invitations")
    @ApiOperation({ summary: "Invite a new member" })
    @ApiResponse({ status: 201, description: "Invitation sent" })
    async inviteMember(
        @CurrentUser() user: AuthUser,
        @Param("slug") slug: string,
        @Body() dto: InviteMemberDto
    ) {
        // Verify user is admin
        const membership = await this.organizationsService.getMembership(
            user.id,
            slug
        );
        if (!membership || membership.role !== "admin") {
            throw new ForbiddenException("Admin access required");
        }

        return this.organizationsService.inviteMember(slug, user.id, dto);
    }

    @Patch(":slug/members/:memberId")
    @ApiOperation({ summary: "Update member role" })
    @ApiResponse({ status: 200, description: "Member role updated" })
    async updateMemberRole(
        @CurrentUser() user: AuthUser,
        @Param("slug") slug: string,
        @Param("memberId") memberId: string,
        @Body() dto: UpdateMemberRoleDto
    ) {
        // Verify user is admin
        const membership = await this.organizationsService.getMembership(
            user.id,
            slug
        );
        if (!membership || membership.role !== "admin") {
            throw new ForbiddenException("Admin access required");
        }

        return this.organizationsService.updateMemberRole(slug, memberId, dto.role);
    }

    @Delete(":slug/members/:memberId")
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: "Remove member from organization" })
    @ApiResponse({ status: 204, description: "Member removed" })
    async removeMember(
        @CurrentUser() user: AuthUser,
        @Param("slug") slug: string,
        @Param("memberId") memberId: string
    ) {
        // Verify user is admin
        const membership = await this.organizationsService.getMembership(
            user.id,
            slug
        );
        if (!membership || membership.role !== "admin") {
            throw new ForbiddenException("Admin access required");
        }

        await this.organizationsService.removeMember(slug, memberId);
    }
}

import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsUrl,
    IsEmail,
    Matches,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ROLES, type Role } from "@saas/shared-types";
import type {
    OrganizationResponse,
    MemberResponse,
} from "@saas/shared-types";

export class CreateOrganizationDto {
    @ApiProperty({ example: "Acme Inc" })
    @IsString()
    @IsNotEmpty()
    name!: string;

    @ApiPropertyOptional({
        example: "acme-inc",
        description: "URL-friendly slug (auto-generated if not provided)",
    })
    @IsOptional()
    @IsString()
    @Matches(/^[a-z0-9-]+$/, {
        message: "Slug must contain only lowercase letters, numbers, and hyphens",
    })
    slug?: string;

    @ApiPropertyOptional({ example: "https://example.com/logo.png" })
    @IsOptional()
    @IsUrl()
    logo?: string;
}

export class UpdateOrganizationDto {
    @ApiPropertyOptional({ example: "Acme Corporation" })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: "https://example.com/logo.png" })
    @IsOptional()
    @IsUrl()
    logo?: string;
}

export class InviteMemberDto {
    @ApiProperty({ example: "john@example.com" })
    @IsEmail()
    email!: string;

    @ApiProperty({ enum: [ROLES.ADMIN, ROLES.MEMBER], default: ROLES.MEMBER })
    @IsString()
    @IsNotEmpty()
    role!: Role;
}

export class UpdateMemberRoleDto {
    @ApiProperty({ enum: [ROLES.ADMIN, ROLES.MEMBER] })
    @IsString()
    @IsNotEmpty()
    role!: Role;
}

// Re-export the shared response types for consumers of this module.
export type { OrganizationResponse, MemberResponse };

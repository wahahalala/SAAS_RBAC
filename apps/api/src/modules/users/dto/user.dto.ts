import { IsOptional, IsString, IsUrl } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";
import type { UserResponse } from "@saas/shared-types";

export class UpdateUserDto {
    @ApiPropertyOptional({ example: "John Doe" })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiPropertyOptional({ example: "https://example.com/avatar.jpg" })
    @IsOptional()
    @IsUrl()
    image?: string;
}

// Re-export the shared response type for consumers of this module.
export type { UserResponse };

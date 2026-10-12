import { IsEmail, IsNotEmpty, IsString, MinLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import type { AuthResponse } from "@saas/shared-types";

export class RegisterDto {
    @ApiProperty({ example: "john@example.com" })
    @IsEmail({}, { message: "Please provide a valid email" })
    email!: string;

    @ApiProperty({ example: "secretpassword123", minLength: 8 })
    @IsString()
    @MinLength(8, { message: "Password must be at least 8 characters" })
    password!: string;

    @ApiProperty({ example: "John Doe" })
    @IsString()
    @IsNotEmpty({ message: "Name is required" })
    name!: string;
}

export class LoginDto {
    @ApiProperty({ example: "john@example.com" })
    @IsEmail({}, { message: "Please provide a valid email" })
    email!: string;

    @ApiProperty({ example: "secretpassword123" })
    @IsString()
    @IsNotEmpty({ message: "Password is required" })
    password!: string;
}

export class ForgotPasswordDto {
    @ApiProperty({ example: "john@example.com" })
    @IsEmail({}, { message: "Please provide a valid email" })
    email!: string;
}

export class ResetPasswordDto {
    @ApiProperty({ description: "Reset token from email" })
    @IsString()
    @IsNotEmpty()
    token!: string;

    @ApiProperty({ example: "newsecretpassword123", minLength: 8 })
    @IsString()
    @MinLength(8, { message: "Password must be at least 8 characters" })
    password!: string;
}

// Re-export the shared response type for consumers of this module.
export type { AuthResponse };

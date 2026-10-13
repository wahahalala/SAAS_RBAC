import {
    Controller,
    Post,
    Body,
    HttpCode,
    HttpStatus,
    Get,
    Req,
    Res,
    UseGuards,
    UnauthorizedException,
    Param,
    Delete,
} from "@nestjs/common";
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiExcludeEndpoint,
} from "@nestjs/swagger";
import { AuthGuard } from "@nestjs/passport";
import { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { AuthService, SessionInfo } from "./auth.service";
import {
    RegisterDto,
    LoginDto,
    AuthResponse,
} from "./dto";
import { Public } from "@/common/decorators";
import { SkipTenantCheck } from "@/modules/tenant";

interface OAuthUser {
    email: string;
    name: string;
    image: string | null;
    provider: "google" | "github";
    providerId: string;
}

const REFRESH_COOKIE = "refresh_token";

@ApiTags("Authentication")
@Controller("auth")
export class AuthController {
    constructor(
        private readonly authService: AuthService,
        private readonly configService: ConfigService,
    ) { }

    @Public()
    @Post("register")
    @ApiOperation({ summary: "Register a new user" })
    @ApiResponse({ status: 201, description: "User registered successfully" })
    @ApiResponse({ status: 409, description: "User already exists" })
    async register(
        @Body() dto: RegisterDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AuthResponse> {
        const auth = await this.authService.register(dto, this.sessionInfo(req));
        this.setRefreshCookie(res, auth.refreshToken);
        return this.publicAuthResponse(auth);
    }

    @Public()
    @Post("login")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Login with email and password" })
    @ApiResponse({ status: 200, description: "Login successful" })
    @ApiResponse({ status: 401, description: "Invalid credentials" })
    async login(
        @Body() dto: LoginDto,
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AuthResponse> {
        const auth = await this.authService.login(dto, this.sessionInfo(req));
        this.setRefreshCookie(res, auth.refreshToken);
        return this.publicAuthResponse(auth);
    }

    @Public()
    @Post("refresh")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Refresh access token (refresh token from httpOnly cookie)" })
    @ApiResponse({ status: 200, description: "Token refreshed successfully" })
    @ApiResponse({ status: 401, description: "Invalid refresh token" })
    async refresh(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<AuthResponse> {
        const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
        if (!refreshToken) {
            throw new UnauthorizedException("Refresh token cookie missing");
        }

        const auth = await this.authService.refresh(refreshToken, this.sessionInfo(req));
        this.setRefreshCookie(res, auth.refreshToken);
        return this.publicAuthResponse(auth);
    }

    @Public()
    @Post("logout")
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: "Logout current device (revoke refresh session)" })
    @ApiResponse({ status: 200, description: "Logged out successfully" })
    async logout(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ message: string }> {
        const refreshToken = req.cookies?.[REFRESH_COOKIE] as string | undefined;
        if (refreshToken) {
            await this.authService.logout(refreshToken, this.sessionInfo(req));
        }
        this.clearRefreshCookie(res);
        return { message: "Logged out successfully" };
    }

    @Post("logout-all")
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Logout all devices (revoke all refresh sessions)" })
    @ApiResponse({ status: 200, description: "Logged out from all devices" })
    async logoutAll(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
    ): Promise<{ message: string }> {
        const user = (req as any).user;
        await this.authService.logoutAll(user.id, this.sessionInfo(req));
        this.clearRefreshCookie(res);
        return { message: "Logged out from all devices" };
    }

    @Get("sessions")
    @ApiBearerAuth()
    @ApiOperation({ summary: "List active refresh sessions" })
    @ApiResponse({ status: 200, description: "Active sessions" })
    async listSessions(@Req() req: Request) {
        const user = (req as any).user;
        return this.authService.listSessions(user.id);
    }

    @Delete("sessions/:id")
    @HttpCode(HttpStatus.OK)
    @ApiBearerAuth()
    @ApiOperation({ summary: "Revoke a specific refresh session" })
    @ApiResponse({ status: 200, description: "Session revoked" })
    async revokeSession(@Req() req: Request, @Param("id") id: string) {
        const user = (req as any).user;
        await this.authService.revokeSession(user.id, id);
        return { message: "Session revoked" };
    }

    @Get("me")
    @SkipTenantCheck()
    @ApiBearerAuth()
    @ApiOperation({ summary: "Get current user profile" })
    @ApiResponse({ status: 200, description: "Current user profile" })
    @ApiResponse({ status: 401, description: "Unauthorized" })
    async me(@Req() req: Request) {
        const user = (req as any).user;
        return this.authService.getUserById(user.id);
    }

    @Get("me/permissions")
    @ApiBearerAuth()
    @ApiOperation({ summary: "Get current user's permissions in the tenant" })
    @ApiResponse({ status: 200, description: "Effective permissions" })
    @ApiResponse({
        status: 403,
        description: "X-Tenant-Id header missing or not a member",
    })
    async myPermissions(@Req() req: Request) {
        const user = (req as any).user;
        // Permissions are always tenant-scoped: TenantGuard already rejected
        // the request when the header is missing or the user is not a member.
        const tenantId = (req as any).tenantId;
        if (!tenantId) {
            return { permissions: [] };
        }
        const permissions = await this.authService.getMyPermissions(
            user.id,
            tenantId,
        );
        return { permissions };
    }

    // Google OAuth
    @Public()
    @Get("google")
    @UseGuards(AuthGuard("google"))
    @ApiOperation({ summary: "Initiate Google OAuth login" })
    @ApiResponse({ status: 302, description: "Redirects to Google" })
    googleAuth() {
        // Guard redirects to Google
    }

    @Public()
    @Get("google/callback")
    @UseGuards(AuthGuard("google"))
    @ApiExcludeEndpoint()
    async googleAuthCallback(@Req() req: Request, @Res() res: Response) {
        const user = req.user as OAuthUser;
        const auth = await this.authService.oauthLogin(user, this.sessionInfo(req));

        // Set httpOnly cookie and redirect to frontend callback (access token
        // is passed via query for now; migrate to a one-time code later).
        this.setRefreshCookie(res, auth.refreshToken);
        const frontendUrl = this.configService.get("FRONTEND_URL") || "http://localhost:3000";
        const params = new URLSearchParams({ accessToken: auth.accessToken });
        res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    }

    // GitHub OAuth
    @Public()
    @Get("github")
    @UseGuards(AuthGuard("github"))
    @ApiOperation({ summary: "Initiate GitHub OAuth login" })
    @ApiResponse({ status: 302, description: "Redirects to GitHub" })
    githubAuth() {
        // Guard redirects to GitHub
    }

    @Public()
    @Get("github/callback")
    @UseGuards(AuthGuard("github"))
    @ApiExcludeEndpoint()
    async githubAuthCallback(@Req() req: Request, @Res() res: Response) {
        const user = req.user as OAuthUser;
        const auth = await this.authService.oauthLogin(user, this.sessionInfo(req));

        this.setRefreshCookie(res, auth.refreshToken);
        const frontendUrl = this.configService.get("FRONTEND_URL") || "http://localhost:3000";
        const params = new URLSearchParams({ accessToken: auth.accessToken });
        res.redirect(`${frontendUrl}/auth/callback?${params.toString()}`);
    }

    // Helpers
    private sessionInfo(req: Request): SessionInfo {
        return {
            device: req.headers["user-agent"],
            ipAddress: req.ip || (req.headers["x-forwarded-for"] as string)?.split(",")[0],
        };
    }

    private setRefreshCookie(res: Response, token?: string): void {
        const isProd = this.configService.get("NODE_ENV") === "production";
        const maxAgeMs = this.parseExpiresToMs(
            this.configService.get("JWT_REFRESH_EXPIRATION", "7d"),
        );

        res.cookie(REFRESH_COOKIE, token ?? "", {
            httpOnly: true,
            secure: isProd,
            sameSite: "lax",
            path: "/api/v1/auth",
            maxAge: maxAgeMs,
        });
    }

    private clearRefreshCookie(res: Response): void {
        res.clearCookie(REFRESH_COOKIE, { path: "/api/v1/auth" });
    }

    private publicAuthResponse(auth: AuthResponse): AuthResponse {
        // Never leak the refresh token in the JSON body.
        return {
            accessToken: auth.accessToken,
            user: auth.user,
        };
    }

    private parseExpiresToMs(expiresIn: string): number {
        const match = /^(\d+)([smhd])$/.exec(expiresIn);
        if (!match) return 7 * 24 * 60 * 60 * 1000; // 7 days fallback

        const value = Number(match[1]);
        switch (match[2]) {
            case "s": return value * 1000;
            case "m": return value * 60 * 1000;
            case "h": return value * 60 * 60 * 1000;
            case "d": return value * 24 * 60 * 60 * 1000;
            default: return 7 * 24 * 60 * 60 * 1000;
        }
    }
}

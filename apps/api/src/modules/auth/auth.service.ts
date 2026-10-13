import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import * as bcrypt from "bcrypt";
import { createHash, randomUUID } from "crypto";
import { PrismaService } from "@/prisma/prisma.service";
import { RedisService } from "@/modules/redis/redis.service";
import { RedisKeys } from "@/modules/redis/keys";
import { DomainEventsService } from "@/modules/events";
import { RegisterDto, LoginDto, AuthResponse } from "./dto";

interface JwtPayload {
  sub: string;
  email: string;
  type: "access" | "refresh";
  jti?: string;
}

/**
 * Session metadata captured at login / refresh time.
 * `device` is best-effort (from User-Agent), `ipAddress` from the request.
 */
export interface SessionInfo {
  device?: string;
  ipAddress?: string;
}

/**
 * Shape SessionInfo for an event payload's audit metadata.
 *
 * `device` is the raw User-Agent (also used for the refresh session record), so
 * it doubles as the audit trail's `userAgent`.
 */
function auditRequest(info: SessionInfo): {
  ipAddress?: string;
  userAgent?: string;
} | undefined {
  if (!info.ipAddress && !info.device) return undefined;
  return { ipAddress: info.ipAddress, userAgent: info.device };
}

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_SECONDS = 300; // 5 minutes

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly redis: RedisService,
    private readonly domainEvents: DomainEventsService,
  ) {}

  /**
   * Register a new user.
   */
  async register(dto: RegisterDto, info: SessionInfo = {}): Promise<AuthResponse> {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (existingUser) {
      throw new ConflictException("User with this email already exists");
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        name: dto.name,
      },
    });

    // Emitted AFTER the write commits. A brand-new account belongs to no tenant
    // yet (registration does not provision one), hence tenantId: null.
    this.domainEvents.userCreated({
      tenantId: null,
      actorId: user.id,
      userId: user.id,
      email: user.email,
      name: user.name,
      source: "register",
      request: auditRequest(info),
    });

    return this.generateAuthResponse(user, info);
  }

  /**
   * Login with email and password.
   */
  async login(dto: LoginDto, info: SessionInfo = {}): Promise<AuthResponse> {
    // Redis-based login rate limit (per email, fallback to IP).
    const emailKey = RedisKeys.loginRateLimit(
      `email:${dto.email.toLowerCase()}`,
    );
    const attempts = await this.redis.increment(
      emailKey,
      LOGIN_WINDOW_SECONDS,
    );

    if (attempts > LOGIN_MAX_ATTEMPTS) {
      throw new ForbiddenException(
        "Too many login attempts. Try again later.",
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException("Invalid email or password");
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException("Invalid email or password");
    }

    // Reset the counter after a successful login.
    await this.redis.del(emailKey);

    // Emitted after the credentials check succeeded. Tenant-less: the session
    // exists before the user has selected a tenant, so the audit row records
    // the actor rather than a tenant.
    this.domainEvents.loggedIn({
      tenantId: null,
      actorId: user.id,
      userId: user.id,
      email: user.email,
      method: "password",
      device: info.device,
      request: auditRequest(info),
    });

    return this.generateAuthResponse(user, info);
  }

  /**
   * Refresh the access token using a refresh token.
   *
   * The refresh token itself is never stored; only its SHA-256 hash lives in
   * `RefreshSession.tokenHash`. On use we rotate: revoke the old session and
   * issue a brand-new refresh token.
   */
  async refresh(refreshToken: string, info: SessionInfo = {}): Promise<AuthResponse> {
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify<JwtPayload>(refreshToken, {
        secret: this.configService.get("JWT_REFRESH_SECRET") || this.configService.get("JWT_SECRET"),
      });
    } catch {
      throw new UnauthorizedException("Invalid refresh token");
    }

    if (payload.type !== "refresh") {
      throw new UnauthorizedException("Invalid token type");
    }

    const tokenHash = this.hashToken(refreshToken);
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!session || session.revokedAt || session.expiresAt < new Date()) {
      throw new UnauthorizedException("Session expired or invalid");
    }

    // Rotate: revoke the old refresh session and create a new one.
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    return this.generateAuthResponse(session.user, info);
  }

  /**
   * Logout the current device (revoke a single refresh session by token hash).
   */
  async logout(refreshToken: string, info: SessionInfo = {}): Promise<void> {
    if (!refreshToken) return;
    const tokenHash = this.hashToken(refreshToken);

    // Resolve the owner before revoking: the session row is the only link
    // between the cookie and the user, and the audit entry needs the actor.
    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });

    const revoked = await this.prisma.refreshSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // Only audit an actual revocation: calling logout twice must not produce a
    // second LOGOUT entry for the same session.
    if (revoked.count > 0 && session) {
      this.domainEvents.loggedOut({
        tenantId: null,
        actorId: session.user.id,
        userId: session.user.id,
        email: session.user.email,
        allDevices: false,
        request: auditRequest(info),
      });
    }
  }

  /**
   * Logout all devices for a user.
   */
  async logoutAll(userId: string, info: SessionInfo = {}): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    const revoked = await this.prisma.refreshSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revoked.count > 0 && user) {
      this.domainEvents.loggedOut({
        tenantId: null,
        actorId: user.id,
        userId: user.id,
        email: user.email,
        allDevices: true,
        request: auditRequest(info),
      });
    }
  }

  /**
   * List the current user's active refresh sessions.
   */
  async listSessions(userId: string) {
    const sessions = await this.prisma.refreshSession.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        device: true,
        ipAddress: true,
        expiresAt: true,
        createdAt: true,
      },
    });

    return {
      sessions,
      total: sessions.length,
    };
  }

  /**
   * Revoke a specific session by id (must belong to the user).
   */
  async revokeSession(userId: string, sessionId: string): Promise<void> {
    const session = await this.prisma.refreshSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      throw new NotFoundException("Session not found");
    }

    await this.prisma.refreshSession.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Get the caller's effective permissions in a tenant.
   */
  async getMyPermissions(userId: string, tenantId: string): Promise<string[]> {
    const membership = await this.prisma.membership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: { permission: true },
            },
          },
        },
      },
    });

    if (!membership) {
      return [];
    }

    return membership.role.rolePermissions.map((rp) => rp.permission.key);
  }

  /**
   * Get user by ID (public profile).
   */
  async getUserById(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        createdAt: true,
      },
    });
  }

  /**
   * Validate an access token payload and return the user.
   */
  async validateJwtPayload(payload: JwtPayload) {
    if (payload.type !== "access") {
      throw new UnauthorizedException("Invalid token type");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    return user;
  }

  /**
   * Login or register user from OAuth provider.
   */
  async oauthLogin(
    oauthUser: {
      email: string;
      name: string;
      image: string | null;
      provider: "google" | "github";
      providerId: string;
    },
    info: SessionInfo = {},
  ): Promise<AuthResponse> {
    if (!oauthUser.email) {
      throw new UnauthorizedException("Email is required from OAuth provider");
    }

    let user = await this.prisma.user.findUnique({
      where: { email: oauthUser.email.toLowerCase() },
    });

    if (user) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: {
          name: user.name || oauthUser.name,
          image: user.image || oauthUser.image,
          emailVerified: user.emailVerified || new Date(),
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: oauthUser.email.toLowerCase(),
          name: oauthUser.name,
          image: oauthUser.image,
          emailVerified: new Date(),
        },
      });
    }

    const existingAccount = await this.prisma.account.findFirst({
      where: { userId: user.id, provider: oauthUser.provider },
    });

    if (!existingAccount) {
      await this.prisma.account.create({
        data: {
          userId: user.id,
          type: "oauth",
          provider: oauthUser.provider,
          providerAccountId: oauthUser.providerId,
        },
      });
    }

    this.domainEvents.loggedIn({
      tenantId: null,
      actorId: user.id,
      userId: user.id,
      email: user.email,
      method: "oauth",
      device: info.device,
      request: auditRequest(info),
    });

    return this.generateAuthResponse(user, info);
  }

  /**
   * Generate access + refresh tokens and persist a hashed refresh session.
   */
  private async generateAuthResponse(
    user: {
      id: string;
      email: string;
      name: string | null;
      image: string | null;
      emailVerified: Date | null;
    },
    info: SessionInfo = {},
  ): Promise<AuthResponse> {
    const accessToken = this.signAccessToken(user);
    const { refreshToken, expiresAt } = this.signRefreshToken(user);

    await this.prisma.refreshSession.create({
      data: {
        userId: user.id,
        tokenHash: this.hashToken(refreshToken),
        device: info.device,
        ipAddress: info.ipAddress,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: !!user.emailVerified,
      },
    };
  }

  private signAccessToken(user: { id: string; email: string }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type: "access",
    };

    return this.jwtService.sign(payload, {
      expiresIn: this.configService.get("JWT_ACCESS_EXPIRATION", "15m"),
    });
  }

  private signRefreshToken(user: { id: string; email: string }): {
    refreshToken: string;
    expiresAt: Date;
  } {
    const jti = randomUUID();
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type: "refresh",
      jti,
    };

    const expiresIn = this.configService.get("JWT_REFRESH_EXPIRATION", "7d");
    const refreshToken = this.jwtService.sign(payload, {
      secret:
        this.configService.get("JWT_REFRESH_SECRET") ||
        this.configService.get("JWT_SECRET"),
      expiresIn,
    });

    const expiresAt = this.parseExpiresToDate(expiresIn);
    return { refreshToken, expiresAt };
  }

  /**
   * SHA-256 hash of a token. Storing the hash means a database leak does not
   * expose usable refresh tokens.
   */
  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private parseExpiresToDate(expiresIn: string): Date {
    const match = /^(\d+)([smhd])$/.exec(expiresIn);
    const now = new Date();

    if (!match) {
      // Fallback: 7 days
      now.setDate(now.getDate() + 7);
      return now;
    }

    const value = Number(match[1]);
    const unit = match[2];
    switch (unit) {
      case "s":
        now.setSeconds(now.getSeconds() + value);
        break;
      case "m":
        now.setMinutes(now.getMinutes() + value);
        break;
      case "h":
        now.setHours(now.getHours() + value);
        break;
      case "d":
        now.setDate(now.getDate() + value);
        break;
    }
    return now;
  }
}

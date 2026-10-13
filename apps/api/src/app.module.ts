import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { BullModule } from "@nestjs/bullmq";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./modules/redis";
import { QueueModule } from "./modules/queue";
import { EventModule } from "./modules/events";
import { TenantModule, TenantGuard, TenantInterceptor } from "./modules/tenant";
import { PermissionGuard } from "./common/guards";
import { AuthModule } from "./modules/auth/auth.module";
import { JwtAuthGuard } from "./modules/auth/guards";
import { UsersModule } from "./modules/users/users.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { InvitationsModule } from "./modules/invitations/invitations.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { AuditModule } from "./modules/audit/audit.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { HealthModule } from "./modules/health/health.module";
import { MetricsModule } from "./common/metrics/metrics.module";
import { MetricsInterceptor } from "./common/metrics/metrics.interceptor";

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
        }),

        // BullMQ connection for producers (the worker app owns the processors).
        BullModule.forRootAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                connection: {
                    host: configService.get("REDIS_HOST", "localhost"),
                    port: configService.get<number>("REDIS_PORT", 6379),
                },
            }),
        }),

        // Rate limiting
        ThrottlerModule.forRoot([
            {
                name: "short",
                ttl: 1000,
                limit: 3,
            },
            {
                name: "medium",
                ttl: 10000,
                limit: 20,
            },
            {
                name: "long",
                ttl: 60000,
                limit: 100,
            },
        ]),

        // Core modules
        PrismaModule,
        RedisModule,
        HealthModule,
        MetricsModule,

        // Queue producers (BullMQ)
        QueueModule,

        // Domain events (bus + listeners + cross-process bridge)
        EventModule,

        // Feature modules
        AuthModule,
        UsersModule,
        OrganizationsModule,
        InvitationsModule,
        ReportsModule,
        AuditModule,
        ProjectsModule,
        TenantModule,
    ],
    providers: [
        // Authentication FIRST. Global guards run in the order their APP_GUARD
        // providers are registered on the root module, and every later guard
        // depends on `request.user` being populated by passport.
        {
            provide: APP_GUARD,
            useClass: JwtAuthGuard,
        },
        // Tenant isolation guard. Runs after authentication so `request.user`
        // is available when resolving the X-Tenant-Id membership.
        {
            provide: APP_GUARD,
            useClass: TenantGuard,
        },
        // Wraps each request in the tenant AsyncLocalStorage context.
        {
            provide: APP_INTERCEPTOR,
            useClass: TenantInterceptor,
        },
        // Counts every request for /metrics (after the tenant context has been
        // opened, so the metrics path never thread-leaks tenant state).
        {
            provide: APP_INTERCEPTOR,
            useClass: MetricsInterceptor,
        },
        // Permission guard (RBAC). Runs after TenantGuard so request.tenantId
        // is available for resolving Membership -> Role -> Permissions.
        {
            provide: APP_GUARD,
            useClass: PermissionGuard,
        },
    ],
})
export class AppModule { }


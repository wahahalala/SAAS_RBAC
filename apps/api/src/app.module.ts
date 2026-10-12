import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { PrismaModule } from "./prisma/prisma.module";
import { RedisModule } from "./modules/redis";
import { TenantModule, TenantGuard, TenantInterceptor } from "./modules/tenant";
import { PermissionGuard } from "./common/guards";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { OrganizationsModule } from "./modules/organizations/organizations.module";
import { ProjectsModule } from "./modules/projects/projects.module";
import { HealthModule } from "./modules/health/health.module";

@Module({
    imports: [
        // Configuration
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: ".env",
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

        // Feature modules
        AuthModule,
        UsersModule,
        OrganizationsModule,
        ProjectsModule,
        TenantModule,
    ],
    providers: [
        // Tenant isolation guard. Registered AFTER AuthModule's JwtAuthGuard so
        // authentication runs first and `request.user` is available here.
        {
            provide: APP_GUARD,
            useClass: TenantGuard,
        },
        // Wraps each request in the tenant AsyncLocalStorage context.
        {
            provide: APP_INTERCEPTOR,
            useClass: TenantInterceptor,
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


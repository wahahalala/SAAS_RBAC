import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { ConfigService } from "@nestjs/config";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtStrategy, GoogleStrategy, GitHubStrategy } from "./strategies";

@Module({
    imports: [
        PassportModule.register({ defaultStrategy: "jwt" }),
        JwtModule.registerAsync({
            inject: [ConfigService],
            useFactory: (configService: ConfigService) => ({
                secret: configService.get("JWT_SECRET"),
                signOptions: {
                    expiresIn: configService.get("JWT_ACCESS_EXPIRATION", "15m"),
                },
            }),
        }),
    ],
    controllers: [AuthController],
    providers: [
        AuthService,
        JwtStrategy,
        GoogleStrategy,
        GitHubStrategy,
        // NOTE: the global JwtAuthGuard is registered in AppModule, not here.
        // Nest runs APP_GUARD providers of the ROOT module before those of an
        // imported module, so registering it here made TenantGuard (root)
        // execute first and reject with 401 before passport had run.
    ],
    exports: [AuthService],
})
export class AuthModule { }

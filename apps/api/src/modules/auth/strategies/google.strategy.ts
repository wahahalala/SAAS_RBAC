import { Injectable, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, VerifyCallback, Profile } from "passport-google-oauth20";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, "google") {
    private readonly logger = new Logger(GoogleStrategy.name);

    constructor(configService: ConfigService) {
        const clientID = configService.get("GOOGLE_CLIENT_ID") || "placeholder";
        const clientSecret = configService.get("GOOGLE_CLIENT_SECRET") || "placeholder";

        super({
            clientID,
            clientSecret,
            callbackURL: configService.get("GOOGLE_CALLBACK_URL") || "http://localhost:3001/api/v1/auth/google/callback",
            scope: ["email", "profile"],
        });

        if (clientID === "placeholder" || clientSecret === "placeholder") {
            this.logger.warn("Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
        }
    }

    async validate(
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: VerifyCallback
    ): Promise<void> {
        const { name, emails, photos } = profile;

        const user = {
            email: emails?.[0]?.value || "",
            name: `${name?.givenName || ""} ${name?.familyName || ""}`.trim(),
            image: photos?.[0]?.value || null,
            provider: "google" as const,
            providerId: profile.id,
        };

        done(null, user);
    }
}

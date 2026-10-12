import { Injectable, Logger } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { Strategy, Profile } from "passport-github2";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class GitHubStrategy extends PassportStrategy(Strategy, "github") {
    private readonly logger = new Logger(GitHubStrategy.name);

    constructor(configService: ConfigService) {
        const clientID = configService.get("GITHUB_CLIENT_ID") || "placeholder";
        const clientSecret = configService.get("GITHUB_CLIENT_SECRET") || "placeholder";

        super({
            clientID,
            clientSecret,
            callbackURL: configService.get("GITHUB_CALLBACK_URL") || "http://localhost:3001/api/v1/auth/github/callback",
            scope: ["user:email"],
        });

        if (clientID === "placeholder" || clientSecret === "placeholder") {
            this.logger.warn("GitHub OAuth not configured - set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET");
        }
    }

    async validate(
        _accessToken: string,
        _refreshToken: string,
        profile: Profile,
        done: (error: null, user: any) => void
    ): Promise<void> {
        const { username, displayName, emails, photos } = profile;

        const user = {
            email: emails?.[0]?.value || "",
            name: displayName || username || "",
            image: photos?.[0]?.value || null,
            provider: "github" as const,
            providerId: profile.id,
        };

        done(null, user);
    }
}

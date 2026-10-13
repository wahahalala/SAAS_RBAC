import type { NextConfig } from "next";

/**
 * Upstream NestJS API.
 *
 * Server-side only: the browser never talks to this origin directly, which is
 * what lets the refresh cookie live on the web origin (see the rewrites below).
 */
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";

const nextConfig: NextConfig = {
    reactStrictMode: true,

    /**
     * Serve the API on this origin.
     *
     * Why a rewrite rather than calling the API cross-origin:
     *
     *  - The refresh token is an httpOnly cookie set with `path=/api/v1/auth`.
     *    Proxied through this origin it belongs to the WEB host, so
     *    `cookies()` in a Server Component can read it — a cookie set by the API
     *    host would be invisible to server-side rendering entirely.
     *  - Same-origin means no CORS preflight and a `SameSite=Lax` cookie that
     *    keeps working as the app is deployed to a real domain.
     *
     * The API itself is unchanged: this only changes which host the browser sees.
     */
    async rewrites() {
        return [
            {
                // Everything except auth is proxied to the API. `/api/auth/*` is
                // deliberately NOT rewritten: that path is a Route Handler
                // (app/api/auth/[...path]) which rewrites the refresh cookie's
                // Path before the browser stores it — see that file for why.
                source: "/api/v1/:path*",
                destination: `${API_ORIGIN}/api/v1/:path*`,
            },
        ];
    },

    // Image optimization
    images: {
        remotePatterns: [
            {
                protocol: "https",
                hostname: "avatars.githubusercontent.com",
            },
            {
                protocol: "https",
                hostname: "lh3.googleusercontent.com",
            },
        ],
    },

    // Transpile shared packages
    transpilePackages: ["@saas/shared", "@saas/shared-types", "@saas/validation"],

    // Self-contained production build: `next build` emits a minimal `server.js`
    // plus the traced runtime files into `.next/standalone`, which the web
    // Dockerfile copies instead of the full `node_modules`.
    output: "standalone",
};

export default nextConfig;

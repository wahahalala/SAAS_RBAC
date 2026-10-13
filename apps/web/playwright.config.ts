import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E for the web app.
 *
 * The `webServer` array boots everything a browser test needs, in order:
 *   1. the NestJS API  (compiled first by globalSetup-independent script below)
 *   2. the worker      (consumes BullMQ; the reports flow depends on it)
 *   3. the Next.js app
 *
 * Playwright polls each entry's `url` until it is ready, in array order, so the
 * browser never fires a test before the dependency beneath it is up.
 */
export const API_URL = "http://localhost:3001";
export const WEB_URL = "http://localhost:3100";

export default defineConfig({
    testDir: "./e2e",
    globalSetup: "./e2e/global-setup.ts",
    timeout: 60_000,
    fullyParallel: true,
    // E2E must not interleave with a half-reset database: one worker.
    workers: 1,
    retries: process.env.CI ? 2 : 0,
    reporter: process.env.CI ? [["list"], ["github"]] : "list",

    use: {
        baseURL: WEB_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },

    /**
     * Dev-server cold start dominates the first navigation: `next dev` compiles
     * a route on first request, so a page that has not been visited yet can take
     * several seconds to render. The default 5s assertion timeout is too tight
     * for that (and much tighter than CI runners need), so give navigations and
     * server-action round trips room before failing.
     */
    expect: {
        timeout: 20_000,
    },

    projects: [
        {
            name: "chromium",
            use: { ...devices["Desktop Chrome"] },
        },
    ],

    webServer: [
        {
            // Build once, then serve the compiled API. `../` paths are relative
            // to playwright.config.ts (apps/web).
            command: "node dist/main.js",
            cwd: "../api",
            url: `${API_URL}/api/v1/health`,
            reuseExistingServer: !process.env.CI,
            timeout: 90_000,
        },
        {
            // The worker exposes no HTTP surface; Playwright only needs it to
            // have STARTED (no `url` means "wait for the process to stay up").
            command: "node dist/main.js",
            cwd: "../worker",
            reuseExistingServer: !process.env.CI,
            timeout: 90_000,
        },
        {
            command: "pnpm exec next dev --turbopack -p 3100",
            cwd: ".",
            url: WEB_URL,
            reuseExistingServer: !process.env.CI,
            timeout: 90_000,
        },
    ],
});

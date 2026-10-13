import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";

/**
 * Prepare the environment for browser E2E.
 *
 * Runs before the webServer processes start, so the API/worker it launches read
 * an already-seeded database.
 *
 * The standard seed creates the default tenant and admin user the login tests
 * depend on; the fixture seed adds the permission-less member used by the
 * permission-UI spec. Both are idempotent.
 *
 * NOTE: the API's Jest e2e suite runs against its OWN database (`<name>_e2e`),
 * so it cannot disturb this one.
 */
export default async function globalSetup() {
    const repoRoot = join(process.cwd(), "..");

    const artifacts = join(process.cwd(), "test-results");
    if (!existsSync(artifacts)) mkdirSync(artifacts, { recursive: true });

    // The webServer entries run `node dist/main.js`, so the compiled output must
    // exist before Playwright launches them.
    execSync("pnpm --filter api build", { stdio: "inherit", cwd: repoRoot });
    execSync("pnpm --filter worker build", { stdio: "inherit", cwd: repoRoot });

    execSync("pnpm --filter api db:seed", { stdio: "inherit", cwd: repoRoot });
    execSync("npx tsx test/e2e-fixture-seed.ts", {
        stdio: "inherit",
        cwd: join(repoRoot, "api"),
    });
}

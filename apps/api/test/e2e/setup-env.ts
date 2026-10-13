import { config } from "dotenv";
import { resolve } from "node:path";
import { e2eDatabaseUrl } from "../e2e-database-url";

/**
 * Load environment for the Jest e2e suite and point it at the e2e database.
 *
 * Runs BEFORE any test module (and therefore before PrismaClient is
 * constructed), which is what makes the override effective: Prisma reads
 * DATABASE_URL when the client is instantiated.
 *
 * The database itself is created by jest-e2e-setup.js (globalSetup), which runs
 * earlier still.
 */
config({ path: resolve(__dirname, "../../.env") });

if (process.env.DATABASE_URL) {
    process.env.DATABASE_URL = e2eDatabaseUrl(process.env.DATABASE_URL);
}

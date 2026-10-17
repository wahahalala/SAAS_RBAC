import { config } from "dotenv";
import { resolve } from "node:path";

// PrismaClient does not read .env at runtime, so integration tests that hit the
// shared local database must load it explicitly (same as apps/api's setup).
config({ path: resolve(__dirname, "../.env") });

// CI diagnostic: does DATABASE_URL survive into the vitest process?
console.log(
    "[worker-setup] DATABASE_URL present:",
    process.env.DATABASE_URL ? "YES len=" + process.env.DATABASE_URL.length : "NO",
);

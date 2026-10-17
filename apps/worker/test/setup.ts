import { config } from "dotenv";
import { resolve } from "node:path";

// PrismaClient does not read .env at runtime, so integration tests that hit the
// shared local database must load it explicitly (same as apps/api's setup).
config({ path: resolve(__dirname, "../.env") });

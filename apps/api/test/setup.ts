import { config } from "dotenv";
import { resolve } from "node:path";

// Prisma Client does NOT auto-load .env at runtime, so load it explicitly
// for integration tests (DATABASE_URL).
config({ path: resolve(__dirname, "../.env") });

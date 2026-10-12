import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
    resolve: {
        alias: {
            "@": resolve(__dirname, "src"),
        },
    },
    test: {
        environment: "node",
        globals: true,
        include: ["test/**/*.spec.ts", "src/**/*.spec.ts"],
        setupFiles: ["test/setup.ts"],
        // Integration tests hit a real, SHARED local database and each spec
        // calls `cleanDatabase()` in `beforeAll`. Running spec files in
        // parallel would let one file wipe another's fixtures mid-test, so
        // files run sequentially (tests within a file still run together).
        fileParallelism: false,
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
});

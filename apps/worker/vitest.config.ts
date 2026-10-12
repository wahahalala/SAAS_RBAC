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
        // Integration specs share the local database and truncate tables in
        // their own beforeAll, so spec files run sequentially (as in apps/api).
        // Tests within a file still run together.
        fileParallelism: false,
        testTimeout: 30_000,
    },
});

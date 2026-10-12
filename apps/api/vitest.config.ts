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
        // Integration tests hit a real local database.
        testTimeout: 30_000,
        hookTimeout: 30_000,
    },
});

/**
 * Jest config for the END-TO-END API suite.
 *
 * Unit/integration tests live in `test/*.spec.ts` and run under Vitest; this
 * Jest config covers only `test/e2e/*.e2e-spec.ts`, which spins up the whole
 * Nest app in memory and drives it over HTTP with Supertest.
 *
 * Kept separate from Vitest deliberately:
 *  - Jest uses moduleNameMapper for the `@/` alias
 *  - e2e needs a different lifecycle (one shared app instance, real DB per file)
 *  - the existing Vitest suite must keep working untouched
 */
module.exports = {
    // Creates + migrates the suite's OWN database and points DATABASE_URL at it,
    // so truncating in `resetWorld` cannot wipe the browser E2E's fixtures.
    globalSetup: "<rootDir>/../jest-e2e-setup.js",
    // Loads .env and repoints DATABASE_URL at the e2e database BEFORE any test
    // module (and PrismaClient) is constructed.
    setupFiles: ["<rootDir>/setup-env.ts"],
    moduleFileExtensions: ["js", "json", "ts"],
    rootDir: "test/e2e",
    testRegex: ".*\\.e2e-spec\\.ts$",
    transform: {
        "^.+\\.(t|j)s$": [
            "ts-jest",
            {
                tsconfig: "<rootDir>/tsconfig.e2e.json",
            },
        ],
    },
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/../../src/$1",
    },
    testEnvironment: "node",
    // e2e tests share one live database and truncate in beforeAll, so files
    // must not run in parallel (same assumption as the Vitest suite).
    maxWorkers: 1,
    testTimeout: 30_000,
    // Redis/DB failures surface as test failures, never silent skips.
    forceExit: true,
    detectOpenHandles: true,
};

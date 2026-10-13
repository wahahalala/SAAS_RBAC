/**
 * Jest global setup for the e2e suite.
 *
 * The e2e specs TRUNCATE the whole database in `resetWorld`, so they must not
 * run against the same database the browser E2E (and local development) use —
 * otherwise the two suites wipe each other's fixtures, which shows up as
 * baffling failures (a browser test suddenly seeing "Tenant A" from the Jest
 * world).
 *
 * This points the suite at its own database before any test module loads.
 *
 * The database is created on demand; `CREATE DATABASE` cannot run inside a
 * transaction, so it is issued as a standalone statement and a "already exists"
 * error is tolerated.
 */
module.exports = async function globalSetup() {
    const { Client } = require("pg");

    const base =
        process.env.DATABASE_URL ??
        "postgresql://postgres:postgres@localhost:5432/saas_db";

    const e2eUrl = require("./e2e-database-url").e2eDatabaseUrl(base);

    // Make the URL visible to the test workers (they read process.env).
    process.env.DATABASE_URL = e2eUrl;

    const adminUrl = new URL(base);
    const dbName = new URL(e2eUrl).pathname.replace(/^\//, "");

    const client = new Client({ connectionString: adminUrl.toString() });
    await client.connect();

    const existing = await client.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [dbName],
    );

    if (existing.rowCount === 0) {
        // Identifier cannot be parameterised; quote it.
        await client.query(`CREATE DATABASE "${dbName}"`);
        console.log(`[e2e] created database ${dbName}`);
    }

    await client.end();

    // Apply the schema to the fresh database.
    const { execSync } = require("node:child_process");
    execSync("npx prisma migrate deploy", {
        stdio: "inherit",
        cwd: __dirname + "/..",
        env: { ...process.env, DATABASE_URL: e2eUrl },
    });
};

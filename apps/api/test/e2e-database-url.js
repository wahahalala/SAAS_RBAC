/**
 * Derive the e2e database URL from the configured one.
 *
 * The Jest e2e suite truncates the whole database in `resetWorld`, so it gets
 * its OWN database (`<name>_e2e`) instead of sharing the development one that
 * the browser E2E and local development use.
 *
 * Plain CommonJS on purpose: it is required by both the Jest globalSetup (CJS)
 * and the TypeScript setup file, and needs no build step.
 */
function e2eDatabaseUrl(baseUrl) {
    const url = new URL(baseUrl);
    const name = url.pathname.replace(/^\//, "") || "saas_db";

    // Avoid a double suffix if the configured name already ends in _e2e.
    url.pathname = `/${name.endsWith("_e2e") ? name : `${name}_e2e`}`;

    return url.toString();
}

module.exports = { e2eDatabaseUrl };

/**
 * Guards provided by the app itself.
 *
 * NOTE: authentication (`JwtAuthGuard`) and tenant scoping (`TenantGuard`) are
 * NOT here — they live with their feature module (auth / tenant) and are
 * registered globally in AppModule, in that order. There used to be a
 * duplicate `JwtAuthGuard` and a `RolesGuard` in this folder; neither was ever
 * registered, and the duplicate shadowed the real one, so both were removed.
 */
export * from "./permission.guard";

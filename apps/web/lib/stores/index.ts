/**
 * Client stores.
 *
 * Only UI state lives here (see ui-store). Server data — the user, tenants,
 * members, reports — is fetched by Server Components, so it has no client store
 * to drift out of sync with.
 */
export * from "./ui-store";

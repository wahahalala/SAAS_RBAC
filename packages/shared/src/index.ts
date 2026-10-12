// Compatibility facade.
//
// All domain types and constants now live in `@saas/shared-types`.
// This package re-exports them so existing imports such as
// `import { Role } from "@saas/shared"` keep working without duplicating code.
//
// Prefer importing from `@saas/shared-types` in new code.

export * from "@saas/shared-types";

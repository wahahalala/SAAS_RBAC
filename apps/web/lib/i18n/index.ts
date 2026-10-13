import { cache } from "react";
import { DEFAULT_LOCALE, type Locale } from "./config";
import { getLocale } from "./locale-cookie";
import en, { type Dictionary } from "./dictionaries/en";
import zh from "./dictionaries/zh";

/**
 * Server-side dictionary resolution.
 *
 * SERVER ONLY — it reads the locale cookie (`next/headers`). Client Components
 * must import `Dictionary` and `interpolate` from `./format` instead, so the
 * browser bundle never pulls in `next/headers`.
 */
export { type Dictionary } from "./dictionaries/en";
export { interpolate } from "./format";

/**
 * Static imports (not dynamic `import()`) so the bundler can tree-shake and the
 * server never awaits a module load mid-render. Adding a locale means adding a
 * key here plus its entry in `config.ts`.
 */
const DICTIONARIES: Record<Locale, Dictionary> = {
    en: en as unknown as Dictionary,
    zh,
};

/**
 * The dictionary for the active (cookie) locale.
 *
 * Wrapped in `cache()` so one render resolves the cookie once, however many
 * components ask for their strings — the same reasoning as
 * `resolveActiveTenantId` in the server data layer.
 */
export const getDictionary = cache(async (): Promise<Dictionary> => {
    const locale = await getLocale();
    return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
});

/** The dictionary for an explicit locale (used by tests and tooling). */
export function dictionaryFor(locale: Locale): Dictionary {
    return DICTIONARIES[locale] ?? DICTIONARIES[DEFAULT_LOCALE];
}

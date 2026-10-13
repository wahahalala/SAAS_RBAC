/**
 * Supported locales.
 *
 * `en` is the default and the reference dictionary: its shape is the source of
 * truth for every other locale (see `dictionaries.ts`), so a missing key in a
 * translation is a compile error rather than a runtime fallback.
 */
export const LOCALES = ["en", "zh"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Endonym labels — each locale shown in its OWN language, as users expect. */
export const LOCALE_LABELS: Record<Locale, string> = {
    en: "English",
    zh: "中文",
};

/** Short badge text for the compact switcher button. */
export const LOCALE_SHORT: Record<Locale, string> = {
    en: "EN",
    zh: "中",
};

export function isLocale(value: unknown): value is Locale {
    return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

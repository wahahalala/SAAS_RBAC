import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./config";

/**
 * The active locale, stored as a cookie.
 *
 * Follows the same pattern as the active-tenant cookie: a small preference that
 * Server Components must be able to read during render, which rules out
 * localStorage. Because it is a cookie, the server renders the correct language
 * on the FIRST paint — no flash of English before a client effect switches it.
 *
 * The value is not a secret and the API never sees it, so it is readable from JS
 * and needs no signing.
 */
export const LOCALE_COOKIE = "saas.locale";

/** One year — a language choice should outlive a session. */
const MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/** Read the locale on the SERVER (Server Components, Actions, Route Handlers). */
export async function getLocale(): Promise<Locale> {
    const store = await cookies();
    const value = store.get(LOCALE_COOKIE)?.value;
    return isLocale(value) ? value : DEFAULT_LOCALE;
}

/**
 * Set the locale.
 *
 * Only callable from a Server Action or Route Handler (Server Components cannot
 * mutate cookies).
 */
export async function setLocaleCookie(locale: Locale): Promise<void> {
    const store = await cookies();
    store.set(LOCALE_COOKIE, locale, {
        path: "/",
        maxAge: MAX_AGE_SECONDS,
        sameSite: "lax",
    });
}

"use server";

import { revalidatePath } from "next/cache";
import { isLocale, type Locale } from "@/lib/i18n/config";
import { setLocaleCookie } from "@/lib/i18n/locale-cookie";

/**
 * Switch the interface language.
 *
 * A Server Action rather than a client-side store: the language must be known
 * during server render, so the cookie is the single source of truth and
 * `revalidatePath` is what makes every Server Component re-render with the new
 * dictionary — the same mechanism the tenant switcher uses.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
    if (!isLocale(locale)) return;

    await setLocaleCookie(locale);

    // The whole tree carries translated copy, so revalidate the root layout.
    revalidatePath("/", "layout");
}

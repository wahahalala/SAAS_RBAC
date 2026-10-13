/**
 * Locale-agnostic helpers, safe to import from CLIENT components.
 *
 * Deliberately separate from `lib/i18n/index.ts`: that module calls
 * `cookies()` (via `locale-cookie.ts`) to resolve the active dictionary, and
 * `next/headers` cannot be bundled for the browser. A Client Component that only
 * needs `interpolate` or the `Dictionary` type must import from HERE, or the
 * build fails with "You're importing a component that needs next/headers".
 */
export { type Dictionary } from "./dictionaries/en";

/**
 * Substitute `{name}` placeholders.
 *
 * A tiny stand-in for ICU interpolation: our sentences need at most a couple of
 * values, and keeping it here avoids pulling a formatting library (and its
 * locale data) into the client bundle. Unknown placeholders are left as-is so a
 * typo is visible in the UI rather than silently vanishing.
 */
export function interpolate(
    template: string,
    values: Record<string, string | number>,
): string {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match,
    );
}

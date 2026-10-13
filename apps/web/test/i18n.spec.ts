import { describe, it, expect } from "vitest";
import en, { type Dictionary } from "@/lib/i18n/dictionaries/en";
import zh from "@/lib/i18n/dictionaries/zh";
import { LOCALES, DEFAULT_LOCALE, isLocale, LOCALE_LABELS } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n";

/**
 * Dictionary integrity.
 *
 * The type system already forces `zh` to have the same KEYS as `en` — but not
 * the same leaf kinds (an array in one and a string in the other still
 * type-checks as `Dictionary`, since every leaf widens to `string`). These
 * assertions catch that class of mistake, plus the ones TypeScript cannot see:
 * an untranslated string, an empty value, or a placeholder that drifted.
 */

type Node = string | readonly Node[] | { [key: string]: Node };

function walk(node: Node, path = ""): Array<{ path: string; value: Node }> {
    if (typeof node === "string") return [{ path, value: node }];
    if (Array.isArray(node)) {
        return node.flatMap((item, index) => walk(item, `${path}[${index}]`));
    }
    return Object.entries(node as Record<string, Node>).flatMap(([key, child]) =>
        walk(child, path ? `${path}.${key}` : key),
    );
}

/** Top-level placeholder names, e.g. "{name} invited you" -> ["name"]. */
function placeholders(value: string): string[] {
    return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]!).sort();
}

describe("dictionary shape", () => {
    it("zh has exactly the same leaf structure as en", () => {
        const enLeaves = walk(en as unknown as Node);
        const zhLeaves = walk(zh as unknown as Node);

        const enPaths = enLeaves.map((leaf) => leaf.path);
        const zhPaths = zhLeaves.map((leaf) => leaf.path);

        expect(zhPaths).toEqual(enPaths);
    });

    it("no translation is empty or left as the English text by accident", () => {
        // A handful of values are intentionally identical: proper nouns,
        // industry acronyms that stay in Latin script in Chinese copy (SSO,
        // SLA, API), and the language endonyms.
        const allowedIdentical = new Set([
            "landing.pricing.plans.pro.features[3]", // SSO
            "landing.pricing.plans.enterprise.features[3]", // SLA
        ]);

        for (const leaf of walk(zh as unknown as Node)) {
            expect(typeof leaf.value).toBe("string");
            expect((leaf.value as string).trim().length).toBeGreaterThan(0);
        }

        const enByPath = new Map(
            walk(en as unknown as Node).map((leaf) => [leaf.path, leaf.value as string]),
        );

        const untranslated = walk(zh as unknown as Node)
            .filter((leaf) => {
                const english = enByPath.get(leaf.path);
                return (
                    typeof english === "string" &&
                    english === leaf.value &&
                    !allowedIdentical.has(leaf.path) &&
                    // Placeholder-only differences are real translations of form.
                    /[a-zA-Z]{3,}/.test(leaf.value)
                );
            })
            .map((leaf) => leaf.path);

        expect(untranslated).toEqual([]);
    });

    it("placeholders match between locales", () => {
        // A dropped {name} would render the sentence without the subject.
        const enLeaves = new Map(
            walk(en as unknown as Node).map((leaf) => [
                leaf.path,
                leaf.value as string,
            ]),
        );

        for (const leaf of walk(zh as unknown as Node)) {
            const english = enLeaves.get(leaf.path);
            if (typeof english !== "string") continue;
            expect(placeholders(leaf.value as string)).toEqual(
                placeholders(english),
            );
        }
    });
});

describe("locale config", () => {
    it("exposes a label for every locale", () => {
        for (const locale of LOCALES) {
            expect(LOCALE_LABELS[locale]).toBeTruthy();
        }
    });

    it("defaults to a supported locale", () => {
        expect(LOCALES).toContain(DEFAULT_LOCALE);
    });

    it("isLocale narrows only known values", () => {
        expect(isLocale("en")).toBe(true);
        expect(isLocale("zh")).toBe(true);
        expect(isLocale("fr")).toBe(false);
        expect(isLocale(undefined)).toBe(false);
        expect(isLocale(42)).toBe(false);
    });
});

describe("interpolate", () => {
    it("substitutes named values", () => {
        expect(interpolate("Welcome back, {name}!", { name: "Ada" })).toBe(
            "Welcome back, Ada!",
        );
    });

    it("leaves an unknown placeholder visible instead of dropping it", () => {
        // A silent empty string would hide a typo'd key in production.
        expect(interpolate("Hi {missing}", {})).toBe("Hi {missing}");
    });

    it("stringifies numbers", () => {
        expect(interpolate("{count} members", { count: 3 })).toBe("3 members");
    });
});

// The Dictionary type is what `zh` is annotated with; this keeps the import
// honest (a rename would fail to compile rather than silently drop coverage).
const _typeCheck: Dictionary = zh;
void _typeCheck;

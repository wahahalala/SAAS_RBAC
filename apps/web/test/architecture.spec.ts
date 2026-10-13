import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * Architectural guardrails.
 *
 * The refactor's value is in the SHAPE of the code, and shape is exactly what
 * erodes: the next feature can quietly add a `useEffect` fetch, a client store
 * holding server data, or a client component that bypasses the BFF. These tests
 * assert the structure so that returning to the old pattern fails CI instead of
 * passing review.
 */

const WEB_ROOT = join(__dirname, "..");

function walk(dir: string, out: string[] = []): string[] {
    for (const entry of readdirSync(dir)) {
        if (entry === "node_modules" || entry === ".next") continue;
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) walk(full, out);
        else out.push(full);
    }
    return out;
}

function sources(...dirs: string[]): Array<{ path: string; content: string }> {
    return dirs
        .flatMap((dir) => walk(join(WEB_ROOT, dir)))
        .filter((path) => /\.(ts|tsx)$/.test(path))
        .map((path) => ({ path, content: readFileSync(path, "utf8") }));
}

const APP_PAGES = sources("app").filter(
    (file) => file.path.endsWith("page.tsx") || file.path.endsWith("layout.tsx"),
);

describe("pages fetch on the server", () => {
    it("no page or layout is a client component", () => {
        // A "use client" page cannot fetch on the server, which is the whole
        // point of the refactor: it would force a loading state and a browser
        // request before any data appears.
        const clientPages = APP_PAGES.filter((file) =>
            file.content.trimStart().startsWith('"use client"'),
        ).map((file) => relative(WEB_ROOT, file.path));

        expect(clientPages).toEqual([]);
    });

    it("no page or layout uses TanStack Query", () => {
        const offenders = APP_PAGES.filter((file) =>
            /@tanstack\/react-query/.test(file.content),
        ).map((file) => relative(WEB_ROOT, file.path));

        expect(offenders).toEqual([]);
    });
});

describe("no useEffect data fetching", () => {
    it("nothing fetches inside a useEffect", () => {
        // The pattern the refactor removed. Effects are still legitimate for
        // DOM/subscription work, so this targets fetch specifically.
        const offenders: string[] = [];

        for (const file of sources("app", "components", "lib", "hooks")) {
            if (/^(app[\\/]api|lib[\\/]server)/.test(relative(WEB_ROOT, file.path))) {
                // Route handlers and the server data layer are SUPPOSED to fetch.
                continue;
            }
            const effectBlocks = file.content.match(
                /useEffect\([^)]*=>\s*\{[\s\S]*?\}\s*,?\s*\)/g,
            );
            if (effectBlocks?.some((block) => /\bfetch\(/.test(block))) {
                offenders.push(relative(WEB_ROOT, file.path));
            }
        }

        expect(offenders).toEqual([]);
    });
});

describe("server data stays on the server", () => {
    it("no client store holds server data", () => {
        // Server data duplicated into a client store creates two sources of
        // truth that drift — the tenant/auth stores this refactor removed.
        const storeDir = join(WEB_ROOT, "lib", "stores");
        const contents = readdirSync(storeDir)
            .map((entry) => readFileSync(join(storeDir, entry), "utf8"))
            .join("\n");

        for (const forbidden of [
            "OrganizationMembershipResponse",
            "MemberResponse",
            "ReportResponse",
            "UserResponse",
            "createReport",
            "getOrganizations",
        ]) {
            expect(contents).not.toContain(forbidden);
        }
    });

    it("mutations go through Server Actions", () => {
        // Every action file must opt into the server, or the "use server"
        // guarantee (and the token staying server-side) silently disappears.
        const actionDir = join(WEB_ROOT, "app", "actions");
        const files = readdirSync(actionDir).filter((f) => f.endsWith(".ts"));

        expect(files.length).toBeGreaterThan(0);

        for (const file of files) {
            const content = readFileSync(join(actionDir, file), "utf8");
            expect(content.trimStart().startsWith('"use server"')).toBe(true);
        }
    });

    it("the invitation accept flow does not import a browser API client", () => {
        // The API client and the in-memory token store were removed; anything
        // still importing them would not compile, but this documents the intent.
        const invitePage = readFileSync(
            join(WEB_ROOT, "app", "invitations", "[token]", "page.tsx"),
            "utf8",
        );

        expect(invitePage).not.toContain('"use client"');
        expect(invitePage).not.toContain("api-client");
    });
});

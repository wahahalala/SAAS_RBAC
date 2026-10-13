import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Language switching.
 *
 * The active locale is a cookie read during the SERVER render, so the assertions
 * here are about observable copy: after switching, the interface must be in the
 * other language on the FIRST paint of a fresh navigation (no client-effect
 * flash), and the choice must survive a reload because it was persisted
 * server-side.
 */

/** The switcher is a button labelled with the language's endonym. */
async function switchTo(page: import("@playwright/test").Page, endonym: string) {
    await page.getByRole("button", { name: /Language|语言/ }).click();
    await page.getByRole("menuitem", { name: endonym }).click();
}

/**
 * The card titles on the auth pages are `CardTitle` (a `div`), not a heading
 * element, so these assertions match text rather than a heading role.
 */
function cardTitle(page: import("@playwright/test").Page, text: string) {
    return page.getByText(text, { exact: true });
}

test("the login page can switch to Chinese and back to English", async ({
    page,
}) => {
    await page.goto("/login");

    // English first (the default locale).
    await expect(cardTitle(page, "Welcome back")).toBeVisible();

    await switchTo(page, "中文");
    await expect(cardTitle(page, "欢迎回来")).toBeVisible();

    await switchTo(page, "English");
    await expect(cardTitle(page, "Welcome back")).toBeVisible();
});

test("the choice survives a full reload (it is a server-side cookie)", async ({
    page,
}) => {
    await page.goto("/login");
    await switchTo(page, "中文");
    await expect(cardTitle(page, "欢迎回来")).toBeVisible();

    // A fresh document request: if the locale only lived in client state, this
    // would come back in English.
    await page.reload();
    await expect(cardTitle(page, "欢迎回来")).toBeVisible();
});

test("the dashboard chrome follows the selected language", async ({ page }) => {
    await page.goto("/login");
    await switchTo(page, "中文");

    await signIn(page);

    // Sidebar navigation labels are translated (they come from the dictionary
    // resolved on the server for the active locale).
    await expect(page.getByRole("link", { name: "概览" })).toBeVisible();
    await expect(page.getByRole("link", { name: "团队" })).toBeVisible();
    await expect(page.getByRole("link", { name: "账单" })).toBeVisible();
});

test("the html lang attribute tracks the locale", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "en");

    await switchTo(page, "中文");
    // Correct `lang` matters for screen readers and font selection, and it can
    // only be right if the server knew the locale.
    await expect(page.locator("html")).toHaveAttribute("lang", "zh");
});

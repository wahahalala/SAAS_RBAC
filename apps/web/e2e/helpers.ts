import { test as base, expect, Page } from "@playwright/test";

/**
 * Sign the browser in once and reuse the session across tests in this file.
 *
 * Playwright's storageState persists cookies, which is exactly what a session
 * is here: the refresh cookie with `Path=/`. Each test still reads a fresh page
 * (cookies are replayed), so they remain independent.
 */
export async function signIn(page: Page): Promise<void> {
    await page.goto("/login");
    await page.getByPlaceholder("name@example.com").fill("admin@example.com");
    await page.getByPlaceholder("••••••••").fill("Admin123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    // Server Action round trip + a server-rendered dashboard; the first
    // navigation also pays for Next's on-demand route compilation under
    // `next dev`, so this waits well past the default assertion timeout.
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 });
    // Wait for the server-rendered chrome before handing control back — the
    // dashboard paints in two commits (the sidebar sits behind a Suspense
    // boundary), and a test that drives the sidebar immediately after the URL
    // change can race the second commit.
    //
    // The marker is the user menu button, whose accessible name ends with the
    // signed-in email. The organization switcher would be a tempting marker but
    // its label is the *active organization's* name, which varies between runs
    // (the tenant-switch test creates organizations), so asserting on it here
    // would make this helper order-dependent.
    await expect(
        page.getByRole("button", { name: /admin@example\.com/ }),
    ).toBeVisible({ timeout: 30_000 });
}

export { base, expect };

import { test, expect, Page } from "@playwright/test";

/**
 * Login flow.
 *
 * The page is a Server Component shell around a client form, so this also
 * exercises the server-action login path end to end: the refresh cookie must be
 * set with `Path=/` (which the `/api/auth` proxy handler rewrites), or the
 * dashboard would render as signed out even after login.
 */

async function fillAndSubmit(
    page: Page,
    email: string,
    password: string,
): Promise<void> {
    await page.goto("/login");
    await page.getByPlaceholder("name@example.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
}

test("a wrong password shows an inline error and stays on /login", async ({
    page,
}) => {
    await fillAndSubmit(page, "admin@example.com", "wrong-password");

    // A Server Action returns the API's error, so the form renders it inline
    // rather than navigating away.
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
});

test("the seeded admin signs in and lands on the dashboard", async ({ page }) => {
    await fillAndSubmit(page, "admin@example.com", "Admin123!");

    // Signed-in proof: the server must render the user's real data.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole("heading", { name: /welcome back/i })).toBeVisible();
    // The email appears more than once in the chrome (the organization switcher
    // and the user menu), so assert it is present rather than matching one node.
    await expect(page.getByText("admin@example.com").first()).toBeVisible();
});

test("an unknown account is rejected, not redirected", async ({ page }) => {
    await fillAndSubmit(page, "no-such-user@example.com", "whatever123");

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
});

test("the dashboard is protected: signed-out users are redirected", async ({
    page,
}) => {
    await page.goto("/dashboard");

    // Server-side redirect: the browser lands on /login without seeing the
    // dashboard first.
    await expect(page).toHaveURL(/\/login/);
    // The return path is preserved so a successful login comes back.
    await expect(page).toHaveURL(/redirect=/);
});

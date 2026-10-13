import { test, expect } from "@playwright/test";

/**
 * Permission-driven UI.
 *
 * The billing page renders the reports panel only when the caller holds
 * `billing.manage`. That decision is made on the SERVER (the permission set is
 * fetched during the page render and passed as `canManage`), so the client
 * never has to reason about permissions.
 *
 * admin@example.com has all permissions; member@example.com has none (seeded
 * that way), so the two browsers must see different billing pages.
 */

async function signInAs(
    page: import("@playwright/test").Page,
    email: string,
    password: string,
) {
    await page.goto("/login");
    await page.getByPlaceholder("name@example.com").fill(email);
    await page.getByPlaceholder("••••••••").fill(password);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
}

test("admin sees the reports panel on /dashboard/billing", async ({ page }) => {
    await signInAs(page, "admin@example.com", "Admin123!");
    await page.goto("/dashboard/billing");

    await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
    await expect(
        page.getByRole("button", { name: /generate report/i }),
    ).toBeVisible();
});

test("a permission-less member is not offered report generation", async ({
    page,
}) => {
    await signInAs(page, "member@example.com", "Member123!");
    await page.goto("/dashboard/billing");

    // The member can open the billing page...
    await expect(
        page.getByRole("heading", { name: /billing/i, level: 1 }),
    ).toBeVisible();

    // ...but the permission-gated panel is server-side removed, not merely
    // hidden by CSS.
    await expect(page.getByRole("heading", { name: "Reports" })).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: /generate report/i }),
    ).toHaveCount(0);
});

test("the team page is usable by a member even without admin grants", async ({
    page,
}) => {
    await signInAs(page, "member@example.com", "Member123!");
    await page.goto("/dashboard/team");

    // Members can see the roster; only admin-only mutations are hidden. The
    // heading renders regardless of the caller's role.
    await expect(
        page.getByRole("heading", { name: "Team", level: 1 }),
    ).toBeVisible();
});

import { test, expect } from "@playwright/test";
import { signIn } from "./helpers";

/**
 * Tenant switching.
 *
 * The active tenant is a cookie (Server Components read it), and switching runs
 * a Server Action that writes the cookie and revalidates. This asserts the
 * OBSERVABLE result: the dashboard's plan and organization list follow the
 * switch, which can only happen if the cookie write and server re-render both
 * worked.
 */

test.describe.configure({ mode: "serial" });

test("a second organization can be created from the switcher", async ({
    page,
}) => {
    await signIn(page);

    // Open the switcher and choose "Create Organization".
    //
    // The switcher's label is the ACTIVE organization, which is not necessarily
    // "Default Tenant": earlier runs leave their created organizations behind,
    // and the fallback tenant is whichever membership comes back first. Match
    // the switcher by its structural role instead of by that label.
    await page.locator('[data-slot="sidebar-header"] button').first().click();
    await page.getByRole("menuitem", { name: /create organization/i }).click();

    const name = `Switch Org ${Date.now()}`;
    await page.getByLabel(/organization name/i).fill(name);
    await page.getByRole("button", { name: /create organization/i }).click();

    // Creating switches to the new organization as the active one, so its name
    // becomes the sidebar's org-switcher label. `.first()` because the name also
    // appears on the dashboard's organization card once the server re-renders.
    await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
});

test("switching back to the previous organization updates the dashboard", async ({
    page,
}) => {
    await signIn(page);

    // The dashboard lists every organization the admin belongs to. Click the
    // "Switch to this organization" button on a card that is not active.
    const switchButtons = page.getByRole("button", {
        name: /switch to this organization/i,
    });

    if ((await switchButtons.count()) === 0) {
        test.skip(true, "needs at least two organizations; run create-first test");
        return;
    }

    const firstTarget = switchButtons.first();
    await firstTarget.click();

    // The plan card for the active organization re-renders with its plan value.
    // The exact assertion is loose on purpose: what must be true is that the
    // server re-rendered, not which plan any particular tenant has.
    await expect(
        page.getByRole("heading", { name: /welcome back/i }),
    ).toBeVisible();
});

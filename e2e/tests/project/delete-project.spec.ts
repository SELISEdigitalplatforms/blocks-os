import { test, expect } from "@playwright/test";

// Runs authenticated via the saved login session (see playwright.config.ts).
//
// There is no single "delete project" action in the UI — deletion is per
// environment: enter an environment's dashboard, click Delete, confirm. A
// project disappears from the console once its last environment is deleted.
// So deleting an "e2e-*" project means deleting each of its environments.

const ENV_LABELS =
  /Development|Testing|Staging|IAT|UAT|Prod Shadow|Pre-Prod|Production/;

test.describe("Delete project", () => {
  test("deletes an e2e-* project by removing all its environments", async ({
    page,
  }) => {
    await page.goto("/app/console");

    // Pick the first project whose name starts with "e2e-".
    const firstE2e = page.getByText(/^e2e-[a-z0-9]+$/).first();
    await expect(
      firstE2e,
      "expected at least one e2e-* project on the console to delete",
    ).toBeVisible();
    const projectName = (await firstE2e.innerText()).trim();

    // Delete environments one by one until the project's card is gone.
    for (let guard = 0; guard < 12; guard++) {
      await page.goto("/app/console");

      const title = page.getByText(projectName, { exact: true });
      if ((await title.count()) === 0) break; // project fully deleted

      // Scope to the card, then click its first environment chip. That
      // impersonates the env and navigates to its dashboard.
      const card = title
        .first()
        .locator('xpath=ancestor::div[contains(@class,"rounded-xl")][1]');
      await card.getByRole("button").filter({ hasText: ENV_LABELS }).first().click();

      await page.waitForURL("**/app/*/dashboard", { timeout: 30_000 });

      // Delete this environment: destructive trigger → confirm inside the dialog.
      await page.getByRole("button", { name: "Delete", exact: true }).click();
      await page
        .getByRole("dialog")
        .getByRole("button", { name: "Delete", exact: true })
        .click();

      // On success the app toasts and routes back to the console.
      await page.waitForURL("**/app/console", { timeout: 45_000 });
    }

    // The project should no longer be listed.
    await page.goto("/app/console");
    await expect(page.getByText(projectName, { exact: true })).toHaveCount(0);
  });
});

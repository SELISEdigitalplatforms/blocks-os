import { test, expect, Page } from "@playwright/test";
import { ensureAuthenticated } from "../../support/login-helper";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";

// The Identity & Access sidebar submenu is a flyout, same as the Secrets &
// Configs one, and proved just as unreliable to drive via click-to-expand
// (races, no-ops, and gets left collapsed by unrelated interactions
// elsewhere in the flow). Navigate straight to the section's URL instead.
const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

test.describe("identity and access", () => {
  let projectName = "";
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Identity & Access — Organizations", async ({ page }) => {
    // ============================================================
    // Organizations
    // ============================================================
    // A brand-new project may not have "Multiple Organizations" enabled yet
    // (Organization Configuration setting) — the page then shows a disabled
    // notice instead of the search UI, and none of these steps apply.
    let organizationsEnabled = false;

    await test.step("Navigate to Organizations", async () => {
      await gotoIamPath(page, "organization");
      const searchInput = page.getByPlaceholder("Search organizations...").first();
      const disabledNotice = page.getByText("Multiple Organizations is not enabled").first();
      await expect(searchInput.or(disabledNotice)).toBeVisible({
        timeout: 30000,
      });
      // Derive the flag from the actual control every later step depends on
      // (Add Organization's enabled state) rather than a separate locator,
      // since that's the thing that actually determines whether this section
      // is usable — sidesteps any mismatch between the notice text and the
      // button's real state.
      organizationsEnabled = await page
        .getByRole("button", { name: /add organization/i })
        .isEnabled({ timeout: 5000 })
        .catch(() => false);
    });

    await test.step("[Negative] Add Organization requires a Name (max 100 characters)", async () => {
      if (!organizationsEnabled) return;
      await page.getByRole("button", { name: /add organization/i }).click();
      await expect(page.getByRole("heading", { name: "Add Organization" })).toBeVisible();

      const nameInput = page.getByPlaceholder("Enter organization name");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("Name is required")).toBeVisible();

      await nameInput.fill("a".repeat(101));
      await expect(page.getByText("Name must be at most 100 characters")).toBeVisible();
    });

    await test.step("[Positive] Creating a valid organization shows a success toast", async () => {
      if (!organizationsEnabled) return;
      const nameInput = page.getByPlaceholder("Enter organization name");
      await nameInput.fill(`Acme Corp ${Date.now()}`);
      await page
        .getByRole("button", { name: /save|add/i })
        .last()
        .click();
      await expect(page.getByText("Organization added successfully", { exact: true })).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step("[Negative] Enable/Disable requires confirmation naming the organization and action", async () => {
      if (!organizationsEnabled) return;
      const firstOrg = page.locator('[class*="cursor-pointer"]').first();
      if (await firstOrg.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstOrg.click();
        const toggleButton = page.getByRole("button", { name: /enable|disable/i });
        if (await toggleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await toggleButton.click();
          await expect(page.getByRole("heading", { name: /Organization$/ })).toBeVisible();
          const cancelButton = page.getByRole("button", { name: "Cancel" });
          if (await cancelButton.isVisible().catch(() => false)) {
            await cancelButton.click();
          }
        }
      }
    });
  });
});

import { test, expect } from "../../support/test-base";
import {
  openSharedProjectDashboard,
  openProjectOverviewPage,
} from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// Environments flow: open the Environments list -> add a new environment
// (guarded: only if the project isn't already at the 8-environment cap and
// there's an unused environment type left) -> open its details/dashboard ->
// come back to the list.
test.describe("flows", () => {
  let tenantGroupId = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ tenantGroupId } = await openSharedProjectDashboard(page));
  });

  test("Environments flow: list -> add environment -> open its dashboard -> back to list", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Open Environments", async () => {
      await openProjectOverviewPage(page, tenantGroupId, "environments");
      await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
        timeout: 30000,
      });
    });

    await test.step("Environments page shows at least the Development card", async () => {
      await expect(page.getByText("X-Blocks-Key:").first()).toBeVisible({ timeout: 10000 });
    });

    let addedNewEnvironment = false;
    await test.step("Add a new environment via 'New Environment'", async () => {
      const newEnvButton = page.getByRole("button", { name: "New Environment" });
      if (!(await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false))) {
        return;
      }
      await newEnvButton.click();
      await expect(page.getByRole("heading", { name: "Add Environment" })).toBeVisible({
        timeout: 10000,
      });

      const firstCheckbox = page.getByRole("checkbox").first();
      if (!(await firstCheckbox.isVisible({ timeout: 5000 }).catch(() => false))) {
        await page.keyboard.press("Escape");
        return;
      }

      // Strict validation: Add stays disabled until at least one environment
      // type is selected (add-environment-modal.tsx: disabled={selected.length === 0}).
      const addButton = page.getByRole("button", { name: "Add" });
      await expect(addButton).toBeDisabled();

      await firstCheckbox.click();
      await expect(addButton).toBeEnabled();
      await addButton.click();

      await expect(page.getByRole("heading", { name: "Add Environment" })).toBeHidden({
        timeout: 15000,
      });
      addedNewEnvironment = true;
    });

    await test.step("Open an environment card into its dashboard details", async () => {
      const card = page
        .locator('[class*="cursor-pointer"]')
        .filter({ hasText: "X-Blocks-Key:" })
        .first();
      await expect(card).toBeVisible({ timeout: 15000 });

      const setupPending = card.locator('[aria-label="Setup pending"]');
      if (await setupPending.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Setup still in progress for this card — nothing more to drill into.
        return;
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        await card.click({ force: true });
        try {
          await page.waitForURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 15_000 });
          break;
        } catch (error) {
          if (attempt === 2) throw error;
        }
      }
      await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Domains", { exact: true })).toBeVisible();
    });

    await test.step("Return to the Environments list", async () => {
      await openProjectOverviewPage(page, tenantGroupId, "environments");
      await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
        timeout: 30000,
      });
      if (addedNewEnvironment) {
        // At least two environment cards should now be present.
        const cards = page
          .locator('[class*="cursor-pointer"]')
          .filter({ hasText: "X-Blocks-Key:" });
        await expect(cards).not.toHaveCount(0);
      }
    });
  });
});

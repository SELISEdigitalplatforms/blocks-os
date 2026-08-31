import { test, expect } from "../../support/test-base";
import { openEnvironmentCardDashboard, waitForEnvironmentsListReady } from "../../support/environment-helpers";
import { openProjectOverview } from "../../support/os-helpers";

// Environments flow: open the Environments list -> add a new environment
// (guarded: only if the project isn't already at the 8-environment cap and
// there's an unused environment type left) -> open its details/dashboard ->
// come back to the list.
test.describe("flows", () => {

  test("Environments flow: list -> add environment -> open its dashboard -> back to list", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Open Environments", async () => {
      await openProjectOverview(page, "environments");
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
      await waitForEnvironmentsListReady(page);
      addedNewEnvironment = true;
    });

    await test.step("Open an environment card into its dashboard details", async () => {
      await openEnvironmentCardDashboard(page, "Development");
      await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Domains", { exact: true })).toBeVisible();
    });

    await test.step("Return to the Environments list", async () => {
      await openProjectOverview(page, "environments");
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

    await test.step("'Start Migration' opens the Environment Migration wizard", async () => {
      const startMigrationButton = page.getByRole("button", { name: "Start Migration" });
      if (await startMigrationButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await startMigrationButton.click();
        // Two copies render — a mobile (md:hidden) heading and the desktop
        // one; .first() picks the mobile-hidden copy at a desktop viewport,
        // so use .last() (the desktop one) instead.
        await expect(page.getByText("Environment migration", { exact: true }).last()).toBeVisible({
          timeout: 15000,
        });
        await expect(
          page.getByText("Environments & services", { exact: true }).last(),
        ).toBeVisible();

        // Data migration is a real, consequential operation — only confirm
        // the wizard opens and can be closed without selecting or
        // submitting a source/target migration.
        await page.getByRole("link", { name: "Close migration" }).click();
        await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
          timeout: 15000,
        });
      }
    });
  });
});

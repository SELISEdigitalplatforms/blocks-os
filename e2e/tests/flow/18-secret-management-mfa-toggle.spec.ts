import { test, expect } from "../../support/test-base";
import { openSecretManagementPage } from "../../support/steps/secret-management.steps";

// Real mutation-and-verify test: toggles the first MFA provider's Enable/Disable
// state through the confirmation modal, verifies the badge flips, then toggles
// it back so the test is idempotent and doesn't leave security config changed.
test("18 - toggle an MFA provider and revert (Secret Management)", async ({ page }) => {
  test.setTimeout(120_000);
  await openSecretManagementPage(page, "mfa");

  const firstRow = page.getByRole("table").getByRole("row").nth(1); // row 0 is the header
  const menuButton = firstRow.getByRole("button").last();
  const originalStatus = (await firstRow.getByText(/^(Enabled|Disabled)$/).innerText()) as
    | "Enabled"
    | "Disabled";

  const toggle = async (action: "Enable" | "Disable") => {
    await menuButton.click();
    await page.getByRole("menuitem", { name: action }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Yes" }).click();
    const verb = action === "Enable" ? "enabled" : "disabled";
    await expect(page.getByText(new RegExp(`MFA ${verb} successfully`))).toBeVisible({
      timeout: 15_000,
    });
  };

  const firstAction = originalStatus === "Enabled" ? "Disable" : "Enable";
  const revertAction = firstAction === "Enable" ? "Disable" : "Enable";
  const flippedStatus = originalStatus === "Enabled" ? "Disabled" : "Enabled";

  await toggle(firstAction);
  await expect(firstRow.getByText(flippedStatus)).toBeVisible();

  await toggle(revertAction);
  await expect(firstRow.getByText(originalStatus)).toBeVisible();
});

import { test, expect } from "../../support/test-base";
import { openSecretManagementPage } from "../../support/steps/secret-management.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test: creates a client credential with only the
// required field filled (roles/permissions are optional) and confirms it persisted.
test("19 - add a client credential (Secret Management)", async ({ page }) => {
  test.setTimeout(90_000);
  await openSecretManagementPage(page, "client-credentials");

  const name = `e2e-client-${randomToken(6)}`;

  await page.getByRole("button", { name: "Add" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Client Name").fill(name);
  await dialog.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("Client credential created successfully")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
});

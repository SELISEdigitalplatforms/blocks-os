import { test, expect } from "../../support/test-base";
import { openIdpPage } from "../../support/steps/idp.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test: opens the Add Role dialog, submits it, and
// confirms the new role actually persisted (toast + list row).
test("17 - add a role (IDP)", async ({ page }) => {
  test.setTimeout(90_000);
  await openIdpPage(page, "roles");

  const name = `e2e-role-${randomToken(6)}`;

  await page.getByRole("button", { name: "Add Role" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Name").fill(name);
  await dialog.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("Role added successfully")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
});

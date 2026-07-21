import { test, expect } from "@playwright/test";
import { readFlowState } from "../../support/flow-state";

// Sequential flow — step 2: add a third environment (Staging) to the project
// created in step 1, via the project's Environments page.

test("02 - add another environment (Staging)", async ({ page }) => {
  const { tenantGroupId } = readFlowState();
  expect(tenantGroupId, "run 01-create-project first").toBeTruthy();

  await page.goto(`/app/project/${tenantGroupId}/environments`);

  await page.getByRole("button", { name: "New Environment" }).click();

  // AddEnvironmentModal lists the not-yet-added environments. dev + test are
  // already present, so the first available option is Staging.
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("checkbox").first().check();
  await dialog.getByRole("button", { name: "Add", exact: true }).click();

  // Staging now shows as an environment card.
  await expect(page.getByText("Staging").first()).toBeVisible({
    timeout: 30_000,
  });
});

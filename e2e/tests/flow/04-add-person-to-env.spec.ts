import { test, expect } from "../../support/test-base";
import { readFlowState, requireProject } from "../../support/flow-state";

// Sequential flow — step 4: grant the invited person access to another
// environment (Testing) via their detail page → Environments tab.

test("04 - grant the invited person access to Testing", async ({ page }) => {
  const { tenantGroupId } = requireProject();
  const { personEmail } = readFlowState();
  expect(personEmail, "run 03-invite-people first").toBeTruthy();

  await page.goto(`/app/project/${tenantGroupId}/people`);

  // Open the invited person's detail page.
  const row = page.getByRole("row").filter({ hasText: personEmail! });
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();
  await page.waitForURL(`**/app/project/${tenantGroupId}/people/*`);

  // Environments tab → grant access to Testing (currently without access).
  await page.getByRole("tab", { name: "Environments" }).click();
  await page.getByRole("button", { name: "Grant access to Testing" }).click();

  // Confirm in the modal.
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Grant", exact: true })
    .click();

  await expect(page.getByText(/Access granted to Testing/i)).toBeVisible({
    timeout: 30_000,
  });
});

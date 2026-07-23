import { test, expect } from "../../support/test-base";
import { randomToken, requireProject, writeFlowState } from "../../support/flow-state";

// Sequential flow — step 3: invite a person to the project's Development
// environment. Email: blocks.e2e.<random>@yopmail.com. Saves the email.

test("03 - invite a person to Development", async ({ page }) => {
  const { tenantGroupId } = requireProject();

  const personEmail = `blocks.e2e.${randomToken(6)}@yopmail.com`;

  await page.goto(`/app/project/${tenantGroupId}/people`);
  await page.getByRole("button", { name: "Invite" }).click();

  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Enter email").fill(personEmail);

  // Environment picker is a MultiSelect popover (portaled outside the dialog).
  await dialog.getByRole("button", { name: "Select environments" }).click();
  await page.getByRole("option", { name: "Development" }).click();
  await page.keyboard.press("Escape"); // close the popover

  await dialog.getByRole("button", { name: "Send" }).click();

  // On success the dialog closes and the person appears in the list.
  await expect(dialog).toBeHidden({ timeout: 30_000 });
  await expect(page.getByText(personEmail)).toBeVisible({ timeout: 30_000 });

  writeFlowState({ personEmail });
});

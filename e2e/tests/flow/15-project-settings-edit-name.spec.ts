import { test, expect } from "../../support/test-base";
import { openProjectOverviewPage } from "../../support/steps/project-overview.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test: edits the project name, confirms it persisted
// across a reload, then reverts it so later specs/reruns see the original name.
test("15 - edit project name and revert (Project Settings)", async ({ page }) => {
  test.setTimeout(120_000);
  await openProjectOverviewPage(page, "settings");

  const editButton = page.getByRole("button", { name: "Edit project name" });
  const dialog = page.getByRole("dialog");
  const nameInput = dialog.getByLabel("Project name");
  const saveButton = dialog.getByRole("button", { name: "Save" });

  await editButton.click();
  await expect(nameInput).toBeVisible();
  const originalName = await nameInput.inputValue();
  const updatedName = `${originalName}-e2e-${randomToken(4)}`;

  await nameInput.fill(updatedName);
  await saveButton.click();
  await expect(page.getByText("Project name updated successfully")).toBeVisible({
    timeout: 15_000,
  });
  await expect(dialog).toBeHidden();

  // Persistence check: reload and confirm the new name stuck (not just a local toast).
  await page.reload();
  await editButton.click();
  await expect(nameInput).toHaveValue(updatedName);

  // Round-trip: restore the original name so this test is idempotent across reruns
  // and doesn't leave a renamed project for later-numbered specs.
  await nameInput.fill(originalName);
  await saveButton.click();
  await expect(page.getByText("Project name updated successfully")).toBeVisible({
    timeout: 15_000,
  });
});

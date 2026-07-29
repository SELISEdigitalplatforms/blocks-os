import { test, expect } from "../../support/test-base";
import { openSecretManagementPage } from "../../support/steps/secret-management.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test: adds an SFTP storage configuration (SFTP
// chosen because its fields are plain strings with no external network
// validation, unlike AWS/Azure/S3Compatible) and confirms it persisted.
test("22 - add an SFTP storage configuration (Secret Management)", async ({ page }) => {
  test.setTimeout(90_000);
  await openSecretManagementPage(page, "storage");

  await page.getByRole("button", { name: "Add" }).click();
  await page.getByRole("menuitem", { name: "Add Configuration" }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByLabel("Storage Provider").click();
  await page.getByRole("option", { name: "SFTP" }).click();

  await dialog.getByLabel("Name").fill(`e2e-storage-${randomToken(6)}`);
  await dialog.getByLabel("Host IP Address").fill("sftp.example.com");
  await dialog.getByLabel("PORT").fill("22");
  await dialog.getByLabel("Username").fill("e2euser");
  await dialog.getByLabel("Password").fill("Dummy-Pass-1");
  await dialog.getByLabel("Remote Base Path").fill("/e2e");

  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("New configuration added successfully")).toBeVisible({
    timeout: 15_000,
  });
});

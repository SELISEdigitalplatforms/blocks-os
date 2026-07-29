import { test, expect } from "../../support/test-base";
import { openSecretManagementPage } from "../../support/steps/secret-management.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test: adds a notification configuration (Channel to
// Notify is a fixed, disabled field defaulting to a valid value, so only the
// enabled fields are touched) and confirms it persisted.
test("24 - add a notification configuration (Secret Management)", async ({ page }) => {
  test.setTimeout(90_000);
  await openSecretManagementPage(page, "notification");

  await page.getByRole("button", { name: "Add Configuration" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const name = `e2e-notification-${randomToken(6)}`;
  await dialog.getByLabel("Name").fill(name);

  await dialog.getByLabel("Notification Type").click();
  await page.getByRole("option", { name: "BroadcastReceiverType" }).click();

  await dialog.getByLabel("Notify Method").fill("e2e-notify-method");

  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("New configuration added")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(name)).toBeVisible({ timeout: 15_000 });
});

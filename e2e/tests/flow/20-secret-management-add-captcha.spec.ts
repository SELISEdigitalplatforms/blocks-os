import { test, expect } from "../../support/test-base";
import { openSecretManagementPage } from "../../support/steps/secret-management.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test: adds a captcha configuration and confirms it
// persisted. Only 2 providers exist (reCAPTCHA/hCAPTCHA) — if this project
// already has both configured, "Add Configuration" is blocked with an info
// toast, so this falls back to editing an existing configuration instead.
test("20 - add or update a captcha configuration (Secret Management)", async ({ page }) => {
  test.setTimeout(90_000);
  await openSecretManagementPage(page, "captcha");

  await page.getByRole("button", { name: "Add Configuration" }).click();

  const blockedToast = page.getByText("No additional captcha configurations can be added.");
  const dialog = page.getByRole("dialog");
  const isBlocked = await blockedToast.isVisible({ timeout: 3_000 }).catch(() => false);

  if (isBlocked) {
    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(dialog).toBeVisible();
    await dialog.getByLabel("Site key").fill(`e2e-site-${randomToken(6)}`);
    await dialog.getByLabel("Secret key").fill(`e2e-secret-${randomToken(6)}`);
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Captcha updated successfully")).toBeVisible({ timeout: 15_000 });
    return;
  }

  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Site key").fill(`e2e-site-${randomToken(6)}`);
  await dialog.getByLabel("Secret key").fill(`e2e-secret-${randomToken(6)}`);
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Captcha added successfully")).toBeVisible({ timeout: 15_000 });
});

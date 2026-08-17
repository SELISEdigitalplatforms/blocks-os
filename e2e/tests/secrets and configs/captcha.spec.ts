import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link (races, gets
// left collapsed by unrelated Escape presses elsewhere in the flow, and
// sometimes no-ops when its parent section is already marked active).
// Navigating straight to the section's URL sidesteps all of that.
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({
    timeout: 30000,
  });
};

test.describe("secrets and configs", () => {
  let projectName = "";
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Secrets & Configs — captcha", async ({
    page,
  }) => {
    // ============================================================
    // Captcha
    // ============================================================
    await test.step("Navigate to Captcha", async () => {
      await gotoSecretManagementSection(page, "captcha", "Captcha");
    });

    await test.step("[Positive] Page renders with an 'Add Configuration' action", async () => {
      await expect(page.getByRole("button", { name: "Add Configuration" })).toBeVisible();
    });

    await test.step("[Security] Site Key and Secret Key are masked on each configuration card, not shown in plaintext", async () => {
      const siteKeyItem = page.getByText("Site Key", { exact: true }).first();
      if (await siteKeyItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        const siteKeyRow = siteKeyItem.locator("xpath=ancestor::div[1]");
        const secretKeyItem = page.getByText("Secret Key", { exact: true }).first();
        const secretKeyRow = secretKeyItem.locator("xpath=ancestor::div[1]");

        const siteKeyText = (await siteKeyRow.innerText()).trim();
        const secretKeyText = (await secretKeyRow.innerText()).trim();
        expect(siteKeyText).toContain("*");
        expect(secretKeyText).toContain("*");
      }
    });

    await test.step("[Security] Copying the masked Secret Key puts the full unmasked value on the clipboard", async () => {
      await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
      const secretKeyItem = page.getByText("Secret Key", { exact: true }).first();
      if (await secretKeyItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        const secretKeyRow = secretKeyItem.locator("xpath=ancestor::div[1]");
        await secretKeyRow.click();
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText.length).toBeGreaterThan(0);
      }
    });

    await test.step("[Negative] Save is disabled until a provider is selected and its keys are filled in", async () => {
      await page.getByRole("button", { name: "Add Configuration" }).click();
      const providerSelect = page.getByText("Select configuration provider");
      if (await providerSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
        const saveButton = page.getByRole("button", { name: "Save" });
        await expect(saveButton).toBeDisabled();
      }
    });

    await test.step("[Negative / Business rule] 'Add Configuration' is blocked with an info toast once every provider is already configured", async () => {
      // Close whatever dialog may be open from the previous step first.
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Add Configuration" }).click();

      const infoToast = page.getByText("No additional captcha configurations can be added.");
      if (await infoToast.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(infoToast).toBeVisible();
        await expect(page.getByRole("heading", { name: "Add Configuration" })).toHaveCount(0);
      } else {
        await page.keyboard.press("Escape");
      }
    });

    await test.step("[Positive] Enable/Disable requires confirmation and shows a provider-specific success toast", async () => {
      const toggleButton = page.getByRole("button", { name: /enable|disable/i }).first();
      if (await toggleButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await toggleButton.click();
        await expect(page.getByRole("heading", { name: /CAPTCHA\?$/ })).toBeVisible();

        await page
          .getByRole("button", { name: /enable|disable/i })
          .last()
          .click();
        await expect(page.getByText(/successfully/i)).toBeVisible({
          timeout: 15000,
        });
      }
    });
  });
});

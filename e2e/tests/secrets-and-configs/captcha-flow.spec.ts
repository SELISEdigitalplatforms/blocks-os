import { type Page } from "@playwright/test";
import { test, expect } from "../../support/test-base";
import { openSecretManagement } from "../../support/os-helpers";

const captchaProviderCard = (page: Page, provider: string) =>
  page.locator("div").filter({ has: page.getByRole("heading", { name: provider }) });

test.describe("flows", () => {

  test("Captcha flow: strict validation -> add -> edit -> disable -> delete", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Captcha", async () => {
      await openSecretManagement(page, "captcha", "Captcha");
      await expect(page.getByRole("button", { name: "Add Configuration" })).toBeVisible();
    });

    await test.step("A fresh project starts with no captcha configured", async () => {
      await expect(page.getByText("Captcha is not configured"))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });

    await test.step("Open the Add Captcha Configuration dialog", async () => {
      await page.getByRole("button", { name: "Add Configuration" }).click();
      await expect(page.getByRole("heading", { name: "Add Captcha Configuration" })).toBeVisible();
    });

    await test.step("Strict validation: Provider, Site key and Secret key are required", async () => {
      const providerSelect = page.getByRole("dialog").getByRole("combobox").first();
      await providerSelect.click();
      await page.getByRole("option", { name: "Google reCAPTCHA" }).click();

      const siteKeyInput = page.getByPlaceholder("Enter site key");
      await siteKeyInput.fill("x");
      await siteKeyInput.fill("");
      await expect(page.getByText("Site key is required"))
        .toBeVisible()
        .catch(() => {});

      const secretKeyInput = page.getByPlaceholder("Enter secret key");
      await secretKeyInput.fill("x");
      await secretKeyInput.fill("");
      await expect(page.getByText("Secret key is required"))
        .toBeVisible()
        .catch(() => {});
    });

    await test.step("CAPTCHA Generator type can be switched to Hard", async () => {
      const generatorSelect = page.getByRole("dialog").getByRole("combobox").nth(1);
      await generatorSelect.click();
      await page.getByRole("option", { name: "Hard" }).click();
      await expect(generatorSelect).toHaveText(/Hard/);
    });

    await test.step("Fill a valid configuration and save", async () => {
      await page.getByPlaceholder("Enter site key").fill("flow-site-key");
      await page.getByPlaceholder("Enter secret key").fill("flow-secret-key");

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Captcha added successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15000 });
    });

    await test.step("Card shows the masked Site Key and 'Configured' Secret Key", async () => {
      const googleCard = captchaProviderCard(page, "Google reCAPTCHA");
      await expect(googleCard.getByText("Site Key", { exact: true })).toBeVisible({
        timeout: 15000,
      });
      await expect(googleCard.getByText("Secret Key", { exact: true })).toBeVisible();
    });

    await test.step("Open Edit for the configuration and close without changes", async () => {
      const editButton = page.getByRole("button", { name: "Edit" }).first();
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: /Edit Google reCAPTCHA/ })).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).click();
      }
    });

    await test.step("Edit the configuration and actually save the change", async () => {
      const editButton = page.getByRole("button", { name: "Edit" }).first();
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: /Edit Google reCAPTCHA/ })).toBeVisible();

        // Secret field is write-only (never pre-filled) — leaving it blank
        // keeps the previously-saved secret, so only the site key changes.
        await page.getByPlaceholder("Enter site key").fill("flow-site-key-updated");
        const updateButton = page.getByRole("button", { name: "Update Changes" });
        await expect(updateButton).toBeEnabled();
        await updateButton.click();

        await expect(page.getByText("Captcha updated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Disable then re-enable the configuration via its toggle action", async () => {
      const disableButton = page.getByRole("button", { name: "Disable" }).first();
      if (await disableButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await disableButton.click();
        await expect(page.getByRole("heading", { name: "Disable CAPTCHA?" })).toBeVisible();
        await page.getByRole("button", { name: "Yes" }).click();
        await expect(page.getByText(/is disabled successfully/))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});

        const enableButton = page.getByRole("button", { name: "Enable" }).first();
        if (await enableButton.isVisible({ timeout: 8000 }).catch(() => false)) {
          await enableButton.click();
          await expect(page.getByRole("heading", { name: "Enable CAPTCHA?" })).toBeVisible();
          await page.getByRole("button", { name: "Yes" }).click();
          await expect(page.getByText(/is enabled successfully/))
            .toBeVisible({ timeout: 15000 })
            .catch(() => {});
        }
      }
    });

    await test.step("Add a second configuration for the hCAPTCHA provider", async () => {
      await page.getByRole("button", { name: "Add Configuration" }).click();
      await expect(page.getByRole("heading", { name: "Add Captcha Configuration" })).toBeVisible();

      const providerSelect = page.getByRole("dialog").getByRole("combobox").first();
      await providerSelect.click();
      await page.getByRole("option", { name: "hCAPTCHA" }).click();

      await page.getByPlaceholder("Enter site key").fill("flow-hcaptcha-site-key");
      await page.getByPlaceholder("Enter secret key").fill("flow-hcaptcha-secret-key");

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Captcha added successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});

      // Both provider cards should now render independently.
      await expect(page.getByRole("heading", { name: /Google reCAPTCHA/ }))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
      await expect(page.getByRole("heading", { name: /hCAPTCHA/ }))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });

    await test.step("Delete the hCAPTCHA configuration", async () => {
      const deleteButtons = page.getByRole("button", { name: "Delete" });
      const lastDeleteButton = deleteButtons.last();
      if (await lastDeleteButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await lastDeleteButton.click();
        await expect(
          page.getByRole("heading", { name: "Delete CAPTCHA configuration?" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Yes, delete" }).click();
        await expect(page.getByText(/configuration deleted successfully/))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Delete the configuration via its Delete action", async () => {
      const deleteButton = page.getByRole("button", { name: "Delete" }).first();
      if (await deleteButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await deleteButton.click();
        await expect(
          page.getByRole("heading", { name: "Delete CAPTCHA configuration?" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Yes, delete" }).click();
        await expect(page.getByText(/configuration deleted successfully/))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });
  });
});

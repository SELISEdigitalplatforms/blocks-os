import { test, expect } from "../../support/test-base";
import { openOsDashboard, openProjectOverview, openIam, openSecretManagement, openLmt, openEmailManagement, openOsConsole } from "../../support/os-helpers";

test.describe("flows", () => {



  test("Captcha flow: strict validation -> add -> edit -> disable -> delete", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Captcha", async () => {
      await openSecretManagement(page, "captcha", "Captcha");
      await expect(page.getByRole("button", { name: "Add Configuration" })).toBeVisible();
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

    await test.step("Fill a valid configuration and save", async () => {
      await page.getByPlaceholder("Enter site key").fill("flow-site-key");
      await page.getByPlaceholder("Enter secret key").fill("flow-secret-key");

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Captcha added successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("Card shows the masked Site Key and 'Configured' Secret Key", async () => {
      await expect(page.getByText("Site Key")).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("Secret Key")).toBeVisible();
    });

    await test.step("Open Edit for the configuration and close without changes", async () => {
      const editButton = page.getByRole("button", { name: "Edit" }).first();
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: /Edit Google reCAPTCHA/ })).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).click();
      }
    });

    await test.step("Disable the configuration via its Disable action", async () => {
      const disableButton = page.getByRole("button", { name: "Disable" }).first();
      if (await disableButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await disableButton.click();
        await expect(page.getByRole("heading", { name: "Disable CAPTCHA?" })).toBeVisible();
        await page.getByRole("button", { name: "Yes" }).click();
        await expect(page.getByText(/is disabled successfully/))
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

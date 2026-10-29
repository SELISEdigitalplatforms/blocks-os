import { test } from "../../support/test-base";
import {
  addSecondCaptchaProviderFlow,
  clearLeftoverCaptchaConfigsFlow,
  deleteCaptchaConfigFlow,
  disableAndReenableCaptchaFlow,
  editCaptchaFlow,
  fillAndSaveCaptchaFlow,
  navigateToCaptchaFlow,
  openAddCaptchaDialogFlow,
  openEditCaptchaAndCloseFlow,
  switchCaptchaGeneratorToHardFlow,
  verifyEmptyCaptchaStateFlow,
  verifyProviderCardVisibleFlow,
  verifyStrictValidationFlow,
} from "../../pages/secrets-and-configs/captcha";

test.describe("flows", () => {
  test("Captcha flow: strict validation -> add -> edit -> disable -> delete", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Captcha", async () => {
      await navigateToCaptchaFlow(page);
    });

    await test.step("Start from a clean state", async () => {
      await clearLeftoverCaptchaConfigsFlow(page);
    });

    await test.step("A fresh project starts with no captcha configured", async () => {
      await verifyEmptyCaptchaStateFlow(page);
    });

    await test.step("Open the Add Captcha Configuration dialog", async () => {
      await openAddCaptchaDialogFlow(page);
    });

    await test.step("Strict validation: Provider, Site key and Secret key are required", async () => {
      await verifyStrictValidationFlow(page);
    });

    await test.step("CAPTCHA Generator type can be switched to Hard", async () => {
      await switchCaptchaGeneratorToHardFlow(page);
    });

    await test.step("Fill a valid configuration and save", async () => {
      await fillAndSaveCaptchaFlow(page, "flow-site-key", "flow-secret-key");
    });

    await test.step("Card shows the masked Site Key and 'Configured' Secret Key", async () => {
      await verifyProviderCardVisibleFlow(page, "Google reCAPTCHA");
    });

    await test.step("Open Edit and close without changes", async () => {
      await openEditCaptchaAndCloseFlow(page, /Edit Google reCAPTCHA/);
    });

    await test.step("Edit the configuration and save the change", async () => {
      await editCaptchaFlow(page, "flow-site-key-updated");
    });

    await test.step("Disable then re-enable the configuration", async () => {
      await disableAndReenableCaptchaFlow(page);
    });

    await test.step("Add a second configuration for the hCAPTCHA provider", async () => {
      await addSecondCaptchaProviderFlow(
        page,
        "hCAPTCHA",
        "flow-hcaptcha-site-key",
        "flow-hcaptcha-secret-key",
      );
    });

    await test.step("Delete the hCAPTCHA configuration", async () => {
      await deleteCaptchaConfigFlow(page, "last");
    });

    await test.step("Delete the Google reCAPTCHA configuration", async () => {
      await deleteCaptchaConfigFlow(page, "first");
    });
  });
});

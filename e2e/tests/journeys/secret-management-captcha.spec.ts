import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs captcha journey", () => {
  test("opens Captcha configuration for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "captcha");
    await expectSecretManagementHeader(page, "Captcha", "Bot protection configuration");
  });
});

import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs MFA journey", () => {
  test("opens MFA settings for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "mfa");
    await expectSecretManagementHeader(page, "MFA", "Multi-factor authentication settings");
  });
});

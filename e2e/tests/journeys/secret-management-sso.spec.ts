import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs SSO journey", () => {
  test("opens SSO for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "sso");
    await expectSecretManagementHeader(page, "SSO", "Single sign-on providers");
  });
});

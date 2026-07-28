import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs email journey", () => {
  test("opens Email configuration for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "email");
    await expectSecretManagementHeader(page, "Email", "Email provider configuration");
  });
});

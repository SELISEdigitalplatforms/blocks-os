import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs OIDC journey", () => {
  test("opens OIDC configuration for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "oidc");
    await expectSecretManagementHeader(page, "OIDC", "OpenID Connect configuration");
  });
});

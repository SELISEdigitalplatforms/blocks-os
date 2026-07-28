import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs client credentials journey", () => {
  test("opens client credentials for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "client-credentials");
    await expectSecretManagementHeader(
      page,
      "Client Credentials",
      "OAuth client credentials for service-to-service access",
    );
  });
});

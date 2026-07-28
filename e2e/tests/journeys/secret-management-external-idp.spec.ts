import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs external IdP journey", () => {
  test("opens External IdP for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "external-idp");
    await expectSecretManagementHeader(
      page,
      "External IdP",
      "External identity providers & certificates",
    );
  });
});

import { test } from "../../support/test-base";
import { expectIdpHeader, openIdpPage } from "../../support/steps/idp.steps";

test.describe("IDP OIDC template journey", () => {
  test("opens the OIDC template for the first available project", async ({ page }) => {
    await openIdpPage(page, "oidc-template");
    await expectIdpHeader(page, "OIDC Template", "Configure OIDC template");
  });
});

import { test } from "../../support/test-base";
import { expectIdpHeader, openIdpPage } from "../../support/steps/idp.steps";

test.describe("IDP permissions journey", () => {
  test("opens permissions for the first available project", async ({ page }) => {
    await openIdpPage(page, "permissions");
    await expectIdpHeader(page, "Permissions", "Define and manage granular permissions for access control");
  });
});

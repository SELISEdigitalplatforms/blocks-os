import { test } from "../../support/test-base";
import { expectIdpHeader, openIdpPage } from "../../support/steps/idp.steps";

test.describe("IDP roles journey", () => {
  test("opens roles for the first available project", async ({ page }) => {
    await openIdpPage(page, "roles");
    await expectIdpHeader(page, "Roles", "Create and manage roles that group permissions for users");
  });
});

import { test } from "../../support/test-base";
import { expectIdpHeader, openIdpPage } from "../../support/steps/idp.steps";

test.describe("IDP settings journey", () => {
  test("opens IDP auth settings for the first available project", async ({ page }) => {
    await openIdpPage(page, "settings");
    await expectIdpHeader(
      page,
      "Auth Configuration",
      "Configure authentication policies, token validity, account lockout rules, and certificate settings.",
    );
  });
});

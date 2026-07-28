import { test } from "../../support/test-base";
import { expectOwnProfileVisible, openOwnProfile } from "../../support/steps/account.steps";

test.describe("Profile journey", () => {
  test("opens the authenticated user's profile", async ({ page }) => {
    await openOwnProfile(page);
    await expectOwnProfileVisible(page);
  });
});

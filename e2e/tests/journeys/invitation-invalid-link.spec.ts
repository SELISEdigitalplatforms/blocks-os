import { test } from "../../support/test-base";
import {
  expectInvalidInvitationVisible,
  openInvitationWithoutCode,
} from "../../support/steps/public-flows.steps";

test.describe("Invitation invalid-link journey", () => {
  test("shows an invalid invitation state when no confirmation code is present", async ({ page }) => {
    await openInvitationWithoutCode(page);
    await expectInvalidInvitationVisible(page);
  });
});

import { test } from "../../support/test-base";
import {
  expectInvalidActivationVisible,
  openActivationWithoutCode,
} from "../../support/steps/public-flows.steps";

test.describe("Activation invalid-link journey", () => {
  test("shows an invalid activation state when no activation code is present", async ({ page }) => {
    await openActivationWithoutCode(page);
    await expectInvalidActivationVisible(page);
  });
});

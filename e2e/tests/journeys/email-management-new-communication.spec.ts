import { test } from "../../support/test-base";
import {
  expectNewCommunicationWizardVisible,
  openEmailManagementPage,
} from "../../support/steps/email-management.steps";

test.describe("Email management new communication journey", () => {
  test("opens the new email template wizard for the first available project", async ({ page }) => {
    await openEmailManagementPage(page, "new-communication");
    await expectNewCommunicationWizardVisible(page);
  });
});

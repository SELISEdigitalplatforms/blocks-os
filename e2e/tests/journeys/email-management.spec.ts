import { test } from "../../support/test-base";
import {
  expectEmailTemplatesVisible,
  openEmailManagementPage,
} from "../../support/steps/email-management.steps";

test.describe("Email management journey", () => {
  test("opens email templates for the first available project", async ({ page }) => {
    await openEmailManagementPage(page);
    await expectEmailTemplatesVisible(page);
  });
});

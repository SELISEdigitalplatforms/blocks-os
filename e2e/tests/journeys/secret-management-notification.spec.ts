import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs notification journey", () => {
  test("opens Notification configuration for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "notification");
    await expectSecretManagementHeader(page, "Notification", "Push & notification settings");
  });
});

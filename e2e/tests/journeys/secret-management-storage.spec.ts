import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs storage journey", () => {
  test("opens Storage configuration for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "storage");
    await expectSecretManagementHeader(page, "Storage", "File and object storage");
  });
});

import { test } from "../../support/test-base";
import {
  expectSecretManagementHeader,
  openSecretManagementPage,
} from "../../support/steps/secret-management.steps";

test.describe("Secrets and configs identity providers journey", () => {
  test("opens identity providers for the first available project", async ({ page }) => {
    await openSecretManagementPage(page, "identity-providers");
    await expectSecretManagementHeader(
      page,
      "Identity Provider",
      "Federated external identity providers",
    );
  });
});

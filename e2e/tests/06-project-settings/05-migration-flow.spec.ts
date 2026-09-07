import { test } from "../../support/test-base";
import {
  navigateToEnvironmentsFlow,
  openMigrationWizardFlow,
} from "../../pages/project-settings/environments";

test.describe("flows", () => {
  test("Migration flow: Start Migration opens the Environment Migration wizard", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Open Environments", async () => {
      await navigateToEnvironmentsFlow(page);
    });

    await test.step("'Start Migration' opens the Environment Migration wizard", async () => {
      await openMigrationWizardFlow(page);
    });
  });
});

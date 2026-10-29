import { expect, test } from "../../support/test-base";
import {
  navigateToEnvironmentsFlow,
  openMigrationWizardFlow,
  readAccessibleEnvironmentCount,
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

  test("Migration flow: Start Migration is guarded by environment count and selectors can be cleared", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Open Environments", async () => {
      await navigateToEnvironmentsFlow(page);
    });

    const environmentCount = await readAccessibleEnvironmentCount(page);

    await test.step(
      environmentCount < 2
        ? "One environment: Start Migration is disabled and explains why"
        : "Two or more environments: wizard opens and both selectors clear",
      async () => {
        const opened = await openMigrationWizardFlow(page, { exerciseClear: true });
        expect(opened).toBe(environmentCount >= 2);
      },
    );
  });
});

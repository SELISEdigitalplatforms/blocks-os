import { test } from "../../support/test-base";
import {
  extractEnvironmentItemId,
  recordEnvironmentIds,
} from "../../support/create-and-delete-project";
import {
  addEnvironmentFlow,
  navigateToEnvironmentsFlow,
  openEnvironmentDashboardFlow,
  returnToEnvironmentsListFlow,
  verifyEnvironmentCardVisibleFlow,
} from "../../pages/project-settings/environments";

test.describe("flows", () => {
  test("Environments flow: list Development -> add environment -> open dashboard -> back to list", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Open Environments", async () => {
      await navigateToEnvironmentsFlow(page);
    });

    await test.step("Environments page shows at least the Development card", async () => {
      await verifyEnvironmentCardVisibleFlow(page);
    });

    const addedNewEnvironment = await test.step(
      "Add a new environment via 'New Environment'",
      async () => addEnvironmentFlow(page),
    );

    await test.step("Open an environment card into its dashboard details", async () => {
      await openEnvironmentDashboardFlow(page, "Development");
      const openedId = extractEnvironmentItemId(page.url());
      if (openedId) recordEnvironmentIds([openedId]);
    });

    await test.step("Return to the Environments list", async () => {
      await returnToEnvironmentsListFlow(page, { expectMultipleCards: addedNewEnvironment });
    });
  });
});

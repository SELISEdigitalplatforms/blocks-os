import { test } from "../../support/test-base";
import {
  exerciseSelectRepositoryDialogFlow,
  navigateToRepositoriesFlow,
  openAddRepositoryDialogFlow,
  verifyConnectRepositoryProviderFlow,
  verifyEmptyStateAfterFlow,
  verifyEmptyStateFlow,
} from "../../pages/project-settings/repositories";

test.describe("flows", () => {
  test("Repositories flow: empty state -> open 'Connect repository' -> GitHub provider option", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Open Repositories", async () => {
      await navigateToRepositoriesFlow(page);
    });

    await test.step("A fresh project starts with no repositories", async () => {
      await verifyEmptyStateFlow(page);
    });

    const dialogKind = await test.step("Open 'Add'", async () => {
      return await openAddRepositoryDialogFlow(page);
    });

    await test.step("GitHub is offered as a connection provider", async () => {
      if (dialogKind === "connect") {
        await verifyConnectRepositoryProviderFlow(page);
      }
    });

    await test.step("'Select repository' dialog: provider list, search, and Revoke access dialog", async () => {
      if (dialogKind === "select") {
        await exerciseSelectRepositoryDialogFlow(page);
      }
    });

    await test.step("Repositories list still shows the empty state", async () => {
      await verifyEmptyStateAfterFlow(page);
    });
  });
});

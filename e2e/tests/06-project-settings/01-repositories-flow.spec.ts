import { test } from "../../support/test-base";
import {
  exerciseSelectRepositoryDialogFlow,
  navigateToRepositoriesFlow,
  openAddRepositoryDialogFlow,
  verifyConnectRepositoryProviderFlow,
  verifyEmptyStateOrConnectedListFlow,
  verifyRepositoriesUnchangedFlow,
} from "../../pages/project-settings/repositories";

test.describe("flows", () => {
  test("Repositories flow: empty state -> open 'Connect repository' -> GitHub provider option", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Open Repositories", async () => {
      await navigateToRepositoriesFlow(page);
    });

    // The shared E2E project has had a repository connected since 12/10/2026:
    // assert the empty state only when none is connected, else the list.
    const repositoriesBefore = await test.step(
      "Empty state when no repository is connected, else the connected list with its controls",
      async () => {
        return await verifyEmptyStateOrConnectedListFlow(page);
      },
    );

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

    await test.step("Repositories page still shows the state it started in", async () => {
      await verifyRepositoriesUnchangedFlow(page, repositoriesBefore);
    });
  });
});

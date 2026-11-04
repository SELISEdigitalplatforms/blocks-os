import { test } from "../../support/test-base";
import {
  alreadyAssignedRowsFlow,
  assignFixtureNames,
  assignTwoTemplatesFlow,
  createAssignFixtures,
  deleteAssignFixtures,
  inboundHasNoAssignFlow,
  openEmailPageWithApi,
  selectAllMatchingFlow,
} from "../../pages/secrets-and-configs/assign-templates";

/**
 * blocks-os#734 (SPEC32) §10, in the shared project's Default organization (multi-org on; single-org
 * H11 is covered by unit tests). Every list step searches for the test's own prefix, so Select all
 * only assigns the test's templates (Q1: A). Fixtures are deleted in a finally.
 */
test.describe("Assign templates (#734)", () => {
  test("assign selected templates, already-assigned rows, select all matching, no action on inbound", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const names = assignFixtureNames();
    const api = await openEmailPageWithApi(page);

    try {
      await test.step("Fixtures: two outbound configurations and three templates on the first", async () => {
        await createAssignFixtures(page, api, names);
      });

      await test.step("§10 step 1: assign two templates to the second configuration (H6, H7, H10)", async () => {
        await assignTwoTemplatesFlow(page, names);
      });

      await test.step("§10 step 2: the assigned rows are disabled and say so (H4)", async () => {
        await alreadyAssignedRowsFlow(page, names);
      });

      await test.step("§10 step 3: Select all on the searched list sends allMatching (H8, H9)", async () => {
        await selectAllMatchingFlow(page, names);
      });

      await test.step("§10 step 4: an inbound configuration offers no Assign templates (C1)", async () => {
        await inboundHasNoAssignFlow(page, names);
      });
    } finally {
      await test.step("Cleanup: delete the test's templates and configurations", async () => {
        await deleteAssignFixtures(page, api, names);
      });
    }
  });
});

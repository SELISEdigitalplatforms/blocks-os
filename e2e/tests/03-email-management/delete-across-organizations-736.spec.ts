import { test } from "../../support/test-base";
import { isMultiOrgTemplatesPage } from "../../pages/email-management/copy-to-organizations";
import {
  createDeleteSource,
  createOrganizationCopy,
  defaultOnlyDeleteFlow,
  deleteAcrossDialogFlow,
  deleteDeleteFixtures,
  deleteFixtureNames,
  refusalsFlow,
} from "../../pages/email-management/delete-across-organizations";

/**
 * blocks-os#736 (SPEC34) on the shared project (multi-org on; single-org H10 is covered by the
 * phase-1 lifecycle flow and unit tests). The delete-across request is intercepted, so nothing is
 * deleted or queued by it; the copies lookup, the refusals and the Default-only delete are real calls
 * on the test's own templates, which a finally deletes.
 */
test.describe("Delete a Default template across organizations (#736)", () => {
  test("refusals, What to delete with the real copies lookup, intercepted submits, Default-only delete", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const names = deleteFixtureNames();

    try {
      const api = await createDeleteSource(page, names);

      await test.step("C3: no organizations is refused and deletes nothing (real call)", async () => {
        await refusalsFlow(page, api, names);
      });

      if (!(await isMultiOrgTemplatesPage(page))) return;

      await test.step("C1: the test's organization copy is refused for delete-across (real call)", async () => {
        await createOrganizationCopy(page, api, names);
      });

      await test.step("H6-H8, C11: What to delete, OWN COPY from the lookup, intercepted Selected and All", async () => {
        await deleteAcrossDialogFlow(page, names);
      });

      await test.step("H1: Only the Default organization's template deletes it and keeps the copy", async () => {
        await defaultOnlyDeleteFlow(page, api, names);
      });
    } finally {
      await test.step("Cleanup: delete the test's templates", async () => {
        await deleteDeleteFixtures(page, names);
      });
    }
  });
});

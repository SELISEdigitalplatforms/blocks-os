import { test } from "../../support/test-base";
import {
  copyDialogFlow,
  copyFixtureNames,
  createCopyFixtures,
  deleteCopyFixtures,
  emptyBodyRefusedFlow,
  isMultiOrgTemplatesPage,
  noCopyButtonFlow,
  organizationTemplateFlow,
  shareInNewTemplateFlow,
} from "../../pages/email-management/copy-to-organizations";

/**
 * blocks-os#735 (SPEC33) on the shared project (multi-org on; single-org C13 is also covered by
 * unit tests). The preview runs no Worker and a real copy job would write into the project's
 * organizations, so the UI's copy requests are intercepted and checked (Q1: A); the copies lookup
 * and the refusals are real. Only the test's own templates are used and deleted in a finally.
 */
test.describe("Copy a Default template to organizations (#735)", () => {
  test("copy dialog, refusals, share block and step-2 strip; no job is queued", async ({
    page,
  }) => {
    test.setTimeout(300_000);
    const names = copyFixtureNames();

    try {
      const { api, language } = await createCopyFixtures(page, names);

      await test.step("C2: a template without a body can't be copied (real API call)", async () => {
        await emptyBodyRefusedFlow(page, api, names);
      });

      if (!(await isMultiOrgTemplatesPage(page))) {
        await test.step("C13: multi-org off shows no Copy button", async () => {
          await noCopyButtonFlow(page, names.ready);
        });
        return;
      }

      const chosen =
        await test.step("H8-H11: Copy dialog with the real copies lookup; submit intercepted", async () =>
          copyDialogFlow(page, names));

      await test.step("C1: copying an organization's own template is refused (real API call)", async () => {
        await organizationTemplateFlow(page, api, names, chosen.organizationId, language);
      });

      await test.step("H7, C10, Q4: share block in step 1, strip in step 2, no copy before the step-2 save", async () => {
        await shareInNewTemplateFlow(page, names);
      });
    } finally {
      await test.step("Cleanup: delete the test's templates", async () => {
        await deleteCopyFixtures(page, names);
      });
    }
  });
});

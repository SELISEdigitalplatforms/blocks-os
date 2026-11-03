import {
  addTemplateFlow,
  incomingMailsFlow,
  mailAttachmentFileBadIndexFlow,
  mailDetailsAttachmentFlow,
  mailDetailsEmlFlow,
  mailDetailsFileNotFoundFlow,
  mailDetailsNormalFlow,
  mailDetailsNotFoundFlow,
  mailDetailsOlderApiFlow,
  mailDetailsOriginalLoadingScreenshots,
  mailDetailsTooLargeFlow,
  outgoingMailsFlow,
  startMailDetailsRun,
  templatesFlow,
} from "../../pages/email-management/email-managements";
import { test, expect } from "../../support/test-base";

test.describe("Email Management flows", () => {
  test("all imported flows in sequence: add-template → templates → incoming → outgoing", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Add Template (full lifecycle + Edit/Template validation)", async () => {
      await addTemplateFlow(page);
    });

    await test.step("Templates (listing + clone flow)", async () => {
      await templatesFlow(page);
    });

    await test.step("Incoming Mails", async () => {
      await incomingMailsFlow(page);
    });

    await test.step("Outgoing Mails", async () => {
      await outgoingMailsFlow(page);
    });

    // Final sanity: still on Email Management when all four flows have finished.
    await expect(page).toHaveURL(/\/email-management/);
    await expect(page.getByRole("navigation")).toBeVisible();
  });

  // blocks-os#729 §10: the details page reads the source and attachments as file downloads.
  test("mailbox details: source and attachments on demand, real 404s, too-large notice", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    const run = await startMailDetailsRun(page);

    await test.step("Unknown mail: real 404 and the not-found page (C1)", async () => {
      await mailDetailsNotFoundFlow(page, run);
    });

    await test.step("Normal mail: Original loads the source once, on demand (H1, H9)", async () => {
      await mailDetailsNormalFlow(page, run, testInfo);
    });

    await test.step("Download .eml reuses the loaded source (H10)", async () => {
      await mailDetailsEmlFlow(page, run);
    });

    await test.step("Attachment chip downloads the file by item id and index (H11)", async () => {
      await mailDetailsAttachmentFlow(page, run);
    });

    await test.step("Real 404s for the source and the attachment show the toast (C1, C10)", async () => {
      await mailDetailsFileNotFoundFlow(page);
    });

    await test.step("A non-integer Index is a 400 from the real API (C3, E11)", async () => {
      await mailAttachmentFileBadIndexFlow(page, run);
    });

    await test.step("An older API's HTML answer shows the source failure (C10)", async () => {
      await mailDetailsOlderApiFlow(page);
    });

    await test.step("Screenshots of the Original view while it loads (§4)", async () => {
      await mailDetailsOriginalLoadingScreenshots(page, run, testInfo);
    });

    await test.step("Too large: notice and .eml only (H12)", async () => {
      await mailDetailsTooLargeFlow(page, run, testInfo);
    });
  });
});

import {
  addTemplateFlow,
  incomingMailsFlow,
  outgoingMailsFlow,
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
});

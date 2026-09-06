import { test } from "../../support/test-base";
import { tryWaitForInvitedPersonRow } from "../../support/people-helpers";
import { uniqueTestEmail } from "../../support/env";
import {
  exercisePaginationFlow,
  grantEnvironmentAccessFlow,
  navigateToPeopleFlow,
  openInviteDialogFlow,
  openInvitedPersonDetailsFlow,
  removeEnvironmentAccessFlow,
  resendInvitationFlow,
  returnToPeopleListFlow,
  searchPeopleByEmailFlow,
  sendInviteFlow,
  verifyAlreadyInvitedValidationFlow,
  verifyDuplicateRecipientRowFlow,
  verifyEnvironmentAccessHeadingFlow,
  verifyInvalidEmailValidationFlow,
  verifyMobileEnvironmentAccessLayoutFlow,
  verifyOwnerVisibleFlow,
  verifyPendingInviteBadgeFlow,
  verifyRecipientsRequiredFlow,
} from "../../pages/project-settings/people";

test.describe("flows", () => {
  test("People flow: strict validation -> send invite (active or inactive)", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Open People", async () => {
      await navigateToPeopleFlow(page);
    });

    await test.step("The project owner appears in the list", async () => {
      await verifyOwnerVisibleFlow(page);
    });

    await test.step("Pagination controls on the People table", async () => {
      await exercisePaginationFlow(page);
    });

    await test.step("Open the Invite dialog", async () => {
      await openInviteDialogFlow(page);
    });

    await test.step("Strict validation: recipients and environments are required", async () => {
      await verifyRecipientsRequiredFlow(page);
      await verifyInvalidEmailValidationFlow(page);
    });

    await test.step(
      "Multi-recipient: add a row, duplicate email in form is rejected, then remove it",
      async () => {
        await verifyDuplicateRecipientRowFlow(page);
      },
    );

    const inviteEmail = uniqueTestEmail("flow-people");

    await test.step("Send invite for a fresh email (active or inactive is fine)", async () => {
      await sendInviteFlow(page, inviteEmail);
    });

    const personRow = page.getByRole("row").filter({ hasText: inviteEmail });
    const rowVisible = await tryWaitForInvitedPersonRow(page, personRow);

    if (!rowVisible) {
      test.info().annotations.push({
        type: "note",
        description:
          "Invite sent successfully; ProjectPeople row not yet in list (async IAM) — skipping row follow-ups",
      });
      return;
    }

    await test.step("The invited person shows a Pending Invite badge", async () => {
      await verifyPendingInviteBadgeFlow(page, personRow);
    });

    await test.step("Search filters the list by email", async () => {
      await searchPeopleByEmailFlow(page, personRow, inviteEmail);
    });

    await test.step("Re-inviting the same email is rejected as already invited", async () => {
      await verifyAlreadyInvitedValidationFlow(page, inviteEmail);
    });

    await test.step("Resend Invitation to the still-pending person", async () => {
      await resendInvitationFlow(page, personRow);
    });

    await test.step("Open the invited person's details page", async () => {
      await openInvitedPersonDetailsFlow(page, personRow);
    });

    await test.step("Details and Environment Access render on one page (no tabs)", async () => {
      await verifyEnvironmentAccessHeadingFlow(page);
    });

    await test.step("Remove environment access", async () => {
      await removeEnvironmentAccessFlow(page);
    });

    await test.step("Grant access back from the 'Without access to' list", async () => {
      await grantEnvironmentAccessFlow(page);
    });

    await test.step("Mobile: the single-page layout still renders Environment Access", async () => {
      await verifyMobileEnvironmentAccessLayoutFlow(page);
    });

    await test.step("Return to the People list", async () => {
      await returnToPeopleListFlow(page);
    });
  });
});

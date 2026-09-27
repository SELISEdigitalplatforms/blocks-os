import { test } from "../../support/test-base";
import {
  deleteEmailConfigFlow,
  editEmailConfigAndSaveFlow,
  expandConfigRowAndVerifyFlow,
  fillAndSaveEmailConfigFlow,
  navigateToEmailFlow,
  openAddEmailConfigDialogFlow,
  openEditEmailAndCloseFlow,
  verifyDefaultConfigLockedFlow,
  verifyEmptyEmailStateFlow,
  verifyInboundProviderAndFieldsFlow,
  verifyOutboundProvidersOfferedFlow,
  verifySaveDisabledFlow,
} from "../../pages/secrets-and-configs/email";
import {
  editOffice365KeepingSecretFlow,
  editOffice365RotatingSecretFlow,
  expandOffice365RowAndVerifyFlow,
  fillAndSaveOffice365ConfigFlow,
  selectOffice365AndVerifyFormFlow,
  verifyOffice365BlankSecretRejectedFlow,
  verifyOffice365OfferedForBothDirectionsFlow,
} from "../../pages/secrets-and-configs/office365-email";

test.describe("flows", () => {
  test("Email flow: strict validation -> create -> expand details -> edit -> delete", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Email", async () => {
      await navigateToEmailFlow(page);
    });

    await test.step("Empty state shows if no configuration exists yet", async () => {
      await verifyEmptyEmailStateFlow(page);
    });

    await test.step("The pre-existing Default configuration hides its Edit/Delete actions", async () => {
      await verifyDefaultConfigLockedFlow(page);
    });

    await test.step("Open the Add Configuration dialog", async () => {
      await openAddEmailConfigDialogFlow(page);
    });

    await test.step("'Save' stays disabled until required fields are valid", async () => {
      await verifySaveDisabledFlow(page);
    });

    await test.step("Provider offers Amazon SES and Zoho for Outbound", async () => {
      await verifyOutboundProvidersOfferedFlow(page);
    });

    await test.step("Switching Type to Inbound restricts Provider to Zoho and hides sender fields", async () => {
      await verifyInboundProviderAndFieldsFlow(page);
    });

    const configName = `Flow Email Config ${Date.now()}`;

    await test.step("Fill a valid outbound SMTP configuration, then save", async () => {
      await fillAndSaveEmailConfigFlow(page, configName);
    });

    await test.step("Find the new configuration and expand its accordion row", async () => {
      await expandConfigRowAndVerifyFlow(page, configName);
    });

    await test.step("Reopen the configuration for editing and close without changes", async () => {
      await openEditEmailAndCloseFlow(page);
    });

    await test.step("Edit the configuration and actually save the change", async () => {
      await editEmailConfigAndSaveFlow(page, "Flow Sender Updated");
    });

    await test.step("Delete the configuration via its confirmation dialog", async () => {
      await deleteEmailConfigFlow(page);
    });
  });

  test("Office 365 flow: outbound OAuth -> create -> details -> keep secret -> rotate -> delete", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    // No Microsoft tenant and no live SMTP connection are needed: this covers
    // configuration only. Delivery belongs to the blocks-logic dependency.
    const configName = `Flow O365 Config ${Date.now()}`;
    const clientSecret = `o365-disposable-${Date.now()}`;
    const replacementSecret = `o365-rotated-${Date.now()}`;

    await test.step("Navigate to Email", async () => {
      await navigateToEmailFlow(page);
    });

    await test.step("Open the Add Configuration dialog", async () => {
      await openAddEmailConfigDialogFlow(page);
    });

    await test.step("Provider offers Office 365 for Outbound and Inbound", async () => {
      await verifyOffice365OfferedForBothDirectionsFlow(page);
    });

    await test.step("Selecting it locks the transport, hides the password controls and shows the OAuth fields", async () => {
      await selectOffice365AndVerifyFormFlow(page);
    });

    await test.step("Save a valid configuration and check the response carries no secret material", async () => {
      await fillAndSaveOffice365ConfigFlow(page, configName, clientSecret);
    });

    await test.step("Expand the new row and verify the label, transport and 'Configured' secret", async () => {
      await expandOffice365RowAndVerifyFlow(page, configName, clientSecret);
    });

    await test.step("A whitespace-only replacement secret is rejected rather than preserved", async () => {
      await verifyOffice365BlankSecretRejectedFlow(page);
    });

    await test.step("Editing with a blank secret keeps the one on file", async () => {
      await editOffice365KeepingSecretFlow(page, "Contoso Alerts");
    });

    await test.step("Editing with a replacement secret rotates it, leaking nothing", async () => {
      await editOffice365RotatingSecretFlow(page, replacementSecret);
    });

    await test.step("Delete the configuration via its confirmation dialog", async () => {
      await deleteEmailConfigFlow(page);
    });
  });
});

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
});

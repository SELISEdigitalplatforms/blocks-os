import { test } from "../../support/test-base";
import {
  cancelDeleteConfirmationFlow,
  deleteNotificationConfigFlow,
  editNotificationConfigAndSaveFlow,
  fillAndSaveNotificationConfigFlow,
  findConfigRowFlow,
  navigateToNotificationFlow,
  openAddNotificationDialogFlow,
  openEditAndCloseFlow,
  searchConfigFlow,
  verifyEmptyStateFlow,
  verifyNameAndNotifyMethodValidationFlow,
  verifySaveDisabledFlow,
} from "../../pages/secrets-and-configs/notification";

test.describe("flows", () => {
  test("Notification flow: strict validation -> create -> view row -> edit -> delete", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Notification", async () => {
      await navigateToNotificationFlow(page);
    });

    await test.step("A fresh project starts with no notification configurations", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("Open the Add Configuration dialog", async () => {
      await openAddNotificationDialogFlow(page);
    });

    await test.step("'Save' stays disabled until required fields are valid", async () => {
      await verifySaveDisabledFlow(page);
    });

    await test.step("Strict validation: Name max length and Notify Method min/max length", async () => {
      await verifyNameAndNotifyMethodValidationFlow(page);
    });

    const configName = `Flow Notif ${Date.now()}`;

    await test.step("Fill a valid name, Notification Type, Notify Method, enable Persistence, then save", async () => {
      await fillAndSaveNotificationConfigFlow(page, configName);
    });

    let configRow: Awaited<ReturnType<typeof findConfigRowFlow>>;
    await test.step("Find the new configuration row", async () => {
      configRow = await findConfigRowFlow(page, configName);
    });

    await test.step("Search filters the list by name", async () => {
      await searchConfigFlow(page, configRow, configName);
    });

    await test.step("Reopen the configuration for editing and close without changes", async () => {
      await openEditAndCloseFlow(page, configRow);
    });

    await test.step("Edit the configuration and actually save a change", async () => {
      await editNotificationConfigAndSaveFlow(page, configRow);
    });

    await test.step("Delete confirmation: Cancel leaves the configuration intact", async () => {
      await cancelDeleteConfirmationFlow(page, configRow);
    });

    await test.step("Delete the configuration via its confirmation dialog", async () => {
      await deleteNotificationConfigFlow(page, configRow, configName);
    });
  });
});

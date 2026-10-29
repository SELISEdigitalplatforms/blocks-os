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

    await test.step("The notification list settles (empty state or table)", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("Add Configuration opens the New notification form", async () => {
      await openAddNotificationDialogFlow(page);
    });

    await test.step("'Save' stays disabled until required fields are valid", async () => {
      await verifySaveDisabledFlow(page);
    });

    await test.step("Strict validation: event name length, Send to, channels and rate limit", async () => {
      await verifyNameAndNotifyMethodValidationFlow(page);
    });

    const configName = `Flow Notif ${Date.now()}`;

    await test.step("Fill a valid event name, All users, in-app + inbox, then save", async () => {
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
      await openEditAndCloseFlow(page, configRow, configName);
    });

    await test.step("Edit the configuration and actually save a change", async () => {
      await editNotificationConfigAndSaveFlow(page, configRow, configName);
    });

    await test.step("Delete confirmation: Cancel leaves the configuration intact", async () => {
      await cancelDeleteConfirmationFlow(page, configRow, configName);
    });

    await test.step("Delete the configuration via its confirmation dialog", async () => {
      await deleteNotificationConfigFlow(page, configRow, configName);
    });
  });
});

import { expect, type Locator, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function navigateToNotificationFlow(page: Page) {
  await openSecretManagement(page, "notification", "Notification");
}

export async function verifyEmptyStateFlow(page: Page) {
  if (
    await page.getByText("No notification configurations found").isVisible({ timeout: 10000 })
  ) {
    await expect(page.getByText("No notification configurations found")).toBeVisible();
  }
}

export async function openAddNotificationDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add Configuration" }).click();
  await expect(page.getByRole("heading", { name: "Add Configuration" })).toBeVisible();
}

export async function verifySaveDisabledFlow(page: Page) {
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeDisabled();
  await page.getByPlaceholder("Enter name").fill("ab");
  await expect(saveButton).toBeDisabled();
}

export async function verifyNameAndNotifyMethodValidationFlow(page: Page) {
  const nameInput = page.getByPlaceholder("Enter name");
  await nameInput.fill("a".repeat(101));
  if (
    await page.getByText("Configuration name must be at most 100 characters").isVisible({ timeout: 5000 })
  ) {
    await expect(
      page.getByText("Configuration name must be at most 100 characters"),
    ).toBeVisible();
  }
  await nameInput.fill("");

  const notifyMethodInput = page.getByPlaceholder("Enter notify method");
  await notifyMethodInput.fill("ab");
  if (
    await page.getByText("Notify method must be at least 3 characters").isVisible({ timeout: 5000 })
  ) {
    await expect(page.getByText("Notify method must be at least 3 characters")).toBeVisible();
  }
  await notifyMethodInput.fill("a".repeat(101));
  if (
    await page.getByText("Notify method must be at most 100 characters").isVisible({ timeout: 5000 })
  ) {
    await expect(page.getByText("Notify method must be at most 100 characters")).toBeVisible();
  }
  await notifyMethodInput.fill("");
}

export async function fillAndSaveNotificationConfigFlow(page: Page, configName: string) {
  await page.getByPlaceholder("Enter name").fill(configName);

  const notificationTypeSelect = page
    .getByRole("dialog")
    .getByRole("combobox")
    .filter({ hasText: "NoReceiverType" });
  await notificationTypeSelect.click();
  await page.getByRole("option", { name: "BroadcastReceiverType", exact: true }).click();

  await page.getByPlaceholder("Enter notify method").fill("flow-notify-method");
  await page.getByRole("checkbox").click();

  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeEnabled({ timeout: 10000 });
  await saveButton.click();
  if (
    await page.getByText("New configuration added successfully.").isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("New configuration added successfully.")).toBeVisible();
  }
}

export async function findConfigRowFlow(page: Page, configName: string): Promise<Locator> {
  const configRow = page.getByRole("row").filter({ hasText: configName });
  await expect(configRow).toBeVisible({ timeout: 15000 });
  await expect(configRow.getByText("BroadcastReceiverType")).toBeVisible();
  await expect(configRow.getByText("Yes")).toBeVisible();
  return configRow;
}

export async function searchConfigFlow(page: Page, configRow: Locator, configName: string) {
  const searchInput = page.getByPlaceholder("Search...");
  if (!(await searchInput.isVisible({ timeout: 5000 }))) return;
  await searchInput.fill(configName);
  await expect(configRow).toBeVisible({ timeout: 10000 });

  await searchInput.fill("no-such-config-xyz");
  if (
    await page.getByText("No notification configurations found").isVisible({ timeout: 8000 })
  ) {
    await expect(page.getByText("No notification configurations found")).toBeVisible();
  }

  await searchInput.fill("");
  await expect(configRow).toBeVisible({ timeout: 10000 });
}

export async function openEditAndCloseFlow(page: Page, configRow: Locator) {
  await configRow.getByRole("button").last().click();
  const editItem = page.getByRole("menuitem", { name: "Edit", exact: true });
  await expect(editItem).toBeVisible({ timeout: 8000 });
  await editItem.click();
  await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();
  await expect(page.getByPlaceholder("Enter name")).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();
}

export async function editNotificationConfigAndSaveFlow(page: Page, configRow: Locator) {
  await configRow.getByRole("button").last().click();
  const editItem = page.getByRole("menuitem", { name: "Edit", exact: true });
  await expect(editItem).toBeVisible({ timeout: 8000 });
  await editItem.click();
  await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();

  await page.getByPlaceholder("Enter notify method").fill("flow-notify-method-updated");
  const updateButton = page.getByRole("button", { name: "Update Changes" });
  await expect(updateButton).toBeEnabled({ timeout: 10000 });
  await updateButton.click();
  if (
    await page.getByText("Configuration updated successfully.").isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("Configuration updated successfully.")).toBeVisible();
  }
}

export async function cancelDeleteConfirmationFlow(page: Page, configRow: Locator) {
  await configRow.getByRole("button").last().click();
  const deleteItem = page.getByRole("menuitem", { name: "Delete", exact: true });
  await expect(deleteItem).toBeVisible({ timeout: 8000 });
  await deleteItem.click();
  await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirmation" })).toBeHidden({ timeout: 8000 });
  await expect(configRow).toBeVisible();
}

export async function deleteNotificationConfigFlow(page: Page, configRow: Locator, configName: string) {
  await configRow.getByRole("button").last().click();
  const deleteItem = page.getByRole("menuitem", { name: "Delete", exact: true });
  await expect(deleteItem).toBeVisible({ timeout: 8000 });
  await deleteItem.click();
  await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
  await expect(
    page.getByText(
      new RegExp(`delete the ${escapeRegex(configName)} configuration`),
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  if (
    await page.getByText("Configuration deleted successfully").isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("Configuration deleted successfully")).toBeVisible();
  }
}

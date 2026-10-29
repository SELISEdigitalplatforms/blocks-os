import { expect, type Locator, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

// 6ac0d0fd (feat(notification-ui): receivers, channels and push message form) replaced the
// "Add Configuration" dialog (name, notification type, notify method, persistence) with a
// one-page "New notification" form: event name, send to, receivers, channels and rate limit.
// These helpers follow that form; each check of the old dialog has its counterpart here.

const NAME_ERROR = "Event name must be between 3 and 100 characters.";
const SEND_TO_ERROR = "Select at least one group to send to.";
const CHANNEL_ERROR = "Select at least one channel: in-app or mobile push.";
const RATE_ERROR = "Rate limit must be a whole number from 0 to 600.";
const NO_MATCH = "No configurations match the current filters.";

const eventNameInput = (page: Page) => page.getByRole("textbox", { name: "Event name" });
const saveButton = (page: Page) => page.getByRole("button", { name: "Save", exact: true });
const formErrors = (page: Page) => page.locator("form").getByRole("alert");
// The filter toolbar renders a second, hidden copy of the search box (other layout).
const searchInput = (page: Page) =>
  page.getByPlaceholder("Search by name").filter({ visible: true });

export async function navigateToNotificationFlow(page: Page) {
  await openSecretManagement(page, "notification", "Notification");
}

/** The list settles on either the empty state or the table with its Name column. */
export async function verifyEmptyStateFlow(page: Page) {
  const empty = page.getByText("No notifications yet", { exact: true });
  const table = page.getByRole("columnheader", { name: "Receivers", exact: true });
  await expect(empty.or(table)).toBeVisible({ timeout: 30000 });
}

export async function openAddNotificationDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add Configuration" }).click();
  await expect(page.getByRole("heading", { name: "New notification", level: 1 })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("Notifications / New notification", { exact: true })).toBeVisible();
  await expect(eventNameInput(page)).toBeVisible();
}

export async function verifySaveDisabledFlow(page: Page) {
  await expect(saveButton(page)).toBeDisabled();
  await eventNameInput(page).fill("ab");
  await expect(saveButton(page)).toBeDisabled();
  await expect(formErrors(page)).toContainText(NAME_ERROR);
}

/**
 * Strict validation of the new form: the event name is capped at 100 characters, and Save stays
 * disabled with the reason shown while no group is chosen in Send to, while no channel is on, and
 * while the rate limit is out of range.
 */
export async function verifyNameAndNotifyMethodValidationFlow(page: Page) {
  const nameInput = eventNameInput(page);
  await nameInput.fill("a".repeat(101));
  await expect(nameInput).toHaveValue("a".repeat(100));
  await expect(formErrors(page)).not.toContainText(NAME_ERROR);
  await nameInput.fill("");
  await expect(formErrors(page)).toContainText(NAME_ERROR);
  await nameInput.fill("valid-name");
  await expect(saveButton(page)).toBeEnabled();

  const projectUsers = page.getByRole("checkbox", { name: "Project users" });
  await expect(projectUsers).toBeChecked();
  await projectUsers.click();
  await expect(formErrors(page)).toContainText(SEND_TO_ERROR);
  await expect(saveButton(page)).toBeDisabled();
  await projectUsers.click();
  await expect(formErrors(page)).not.toContainText(SEND_TO_ERROR);

  const inApp = page.getByRole("checkbox", { name: "In-app" });
  await expect(inApp).toBeChecked();
  await inApp.click();
  await expect(formErrors(page)).toContainText(CHANNEL_ERROR);
  await expect(saveButton(page)).toBeDisabled();
  await inApp.click();
  await expect(formErrors(page)).not.toContainText(CHANNEL_ERROR);

  const rate = page.getByRole("textbox", { name: "Rate limit per minute" });
  await expect(rate).toHaveValue("120");
  await rate.fill("601");
  await expect(formErrors(page)).toContainText(RATE_ERROR);
  await expect(saveButton(page)).toBeDisabled();
  await rate.fill("120");
  await expect(formErrors(page)).not.toContainText(RATE_ERROR);
  await expect(saveButton(page)).toBeEnabled();

  await nameInput.fill("");
}

/** Saves a custom notification sent to all project users, in-app and saved to the inbox. */
export async function fillAndSaveNotificationConfigFlow(page: Page, configName: string) {
  await eventNameInput(page).fill(configName);
  await page.getByRole("button", { name: "All users", exact: true }).click();
  await expect(page.getByRole("button", { name: "All users", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("checkbox", { name: "Save to inbox" }).click();
  await expect(page.getByRole("checkbox", { name: "Save to inbox" })).toBeChecked();

  await expect(saveButton(page)).toBeEnabled({ timeout: 10000 });
  await saveButton(page).click();
  await expect(
    page.getByText("New configuration added successfully.", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "New notification", level: 1 })).toBeHidden({
    timeout: 15000,
  });
}

/**
 * The list is paged (10 rows) and holds the built-in notifications too, so the new row is found
 * through the name search, which then stays applied for the row actions that follow.
 */
export async function findConfigRowFlow(page: Page, configName: string): Promise<Locator> {
  await expect(searchInput(page)).toBeVisible({ timeout: 30000 });
  await searchInput(page).fill(configName);
  const configRow = page.getByRole("row").filter({ hasText: configName });
  await expect(configRow).toBeVisible({ timeout: 15000 });
  await expect(configRow.getByText("Custom", { exact: true })).toBeVisible();
  const cells = configRow.getByRole("cell");
  await expect(cells.nth(1)).toHaveText("Project users");
  await expect(cells.nth(2)).toHaveText("All users");
  await expect(cells.nth(3).getByLabel("Yes")).toBeVisible(); // In-app
  await expect(cells.nth(4).getByLabel("No")).toBeVisible(); // Push
  await expect(cells.nth(5).getByLabel("Yes")).toBeVisible(); // Inbox
  await expect(cells.nth(6)).toHaveText("On");
  return configRow;
}

export async function searchConfigFlow(page: Page, configRow: Locator, configName: string) {
  await searchInput(page).fill("no-such-config-xyz");
  await expect(page.getByText(NO_MATCH, { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(configRow).toBeHidden();

  await searchInput(page).fill(configName);
  await expect(configRow).toBeVisible({ timeout: 15000 });
}

async function openEditFromRowFlow(page: Page, configRow: Locator, configName: string) {
  await configRow.getByRole("button", { name: `Actions for ${configName}` }).click();
  const editItem = page.getByRole("menuitem", { name: "Edit", exact: true });
  await expect(editItem).toBeVisible({ timeout: 8000 });
  await editItem.click();
  await expect(page.getByRole("heading", { name: configName, level: 1 })).toBeVisible({
    timeout: 15000,
  });
}

export async function openEditAndCloseFlow(page: Page, configRow: Locator, configName: string) {
  await openEditFromRowFlow(page, configRow, configName);
  // The event name cannot be changed on edit: it is shown as text, not as an input.
  await expect(page.getByText(`Notifications / ${configName}`, { exact: true })).toBeVisible();
  await expect(eventNameInput(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "All users", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("checkbox", { name: "Save to inbox" })).toBeChecked();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(configRow).toBeVisible({ timeout: 15000 });
}

export async function editNotificationConfigAndSaveFlow(
  page: Page,
  configRow: Locator,
  configName: string,
) {
  await openEditFromRowFlow(page, configRow, configName);
  await page.getByRole("button", { name: "Affected users only", exact: true }).click();
  const save = saveButton(page);
  await expect(save).toBeEnabled({ timeout: 10000 });
  await save.click();
  await expect(page.getByText("Configuration updated successfully.", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(configRow.getByRole("cell").nth(2)).toHaveText("Affected users only", {
    timeout: 15000,
  });
}

export async function cancelDeleteConfirmationFlow(
  page: Page,
  configRow: Locator,
  configName: string,
) {
  await configRow.getByRole("button", { name: `Actions for ${configName}` }).click();
  const deleteItem = page.getByRole("menuitem", { name: "Delete", exact: true });
  await expect(deleteItem).toBeVisible({ timeout: 8000 });
  await deleteItem.click();
  const heading = page.getByRole("heading", { name: "Delete notification?" });
  await expect(heading).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(heading).toBeHidden({ timeout: 8000 });
  await expect(configRow).toBeVisible();
}

export async function deleteNotificationConfigFlow(page: Page, configRow: Locator, configName: string) {
  await configRow.getByRole("button", { name: `Actions for ${configName}` }).click();
  const deleteItem = page.getByRole("menuitem", { name: "Delete", exact: true });
  await expect(deleteItem).toBeVisible({ timeout: 8000 });
  await deleteItem.click();
  await expect(page.getByRole("heading", { name: "Delete notification?" })).toBeVisible();
  await expect(page.getByText(`"${configName}" will be deleted.`, { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page.getByText("Notification deleted.", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(configRow).toBeHidden({ timeout: 15000 });
}

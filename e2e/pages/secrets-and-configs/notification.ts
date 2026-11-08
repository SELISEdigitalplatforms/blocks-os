import { expect, type Locator, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

// 6ac0d0fd (feat(notification-ui): receivers, channels and push message form) replaced the
// "Add Configuration" dialog (name, notification type, notify method, persistence) with a
// one-page "New notification" form: event name, send to, receivers, channels and rate limit.
// These helpers follow that form; each check of the old dialog has its counterpart here.
//
// Dev drift since 7e733c40, followed here with each check kept:
// - 83c281a4 (clearer list, header and form pages): one "Recipients" column, whose header also
//   holds the "What recipients mean" help button, replaces Send to + Receivers; Service, Importance,
//   Delivery channels and an Active/Inactive status badge; "Add notification" in the page header;
//   the form has a real breadcrumb ("Notification" > page title) instead of "Notifications / ...".
// - 8f8cca6d (recipients are All users or Targeted; inbox shown as Offline): "Affected users only"
//   is now Targeted with only the Owner tick (listed as "Targeted: owner"); "Save to inbox" is
//   "Offline"; the channels show as named icons ("In-app: on", "Push: off", "Offline: on").
// - 9f396a50 / 61d927b0 / 0cfdc448: "Project users" is "Consumer users", the recipient tick is
//   "Owner", and the channel error names "push" instead of "mobile push".
// - e5a497c6 (i18n): the list's no-match text reads "No notifications match the current filters."

const NAME_ERROR = "Event name must be between 3 and 100 characters.";
const SEND_TO_ERROR = "Select at least one group to send to.";
const CHANNEL_ERROR = "Select at least one channel: in-app or push.";
const RATE_ERROR = "Rate limit must be a whole number from 0 to 600.";
const NO_MATCH = "No notifications match the current filters.";

const eventNameInput = (page: Page) => page.getByRole("textbox", { name: "Event name" });
const saveButton = (page: Page) => page.getByRole("button", { name: "Save", exact: true });
const formErrors = (page: Page) => page.locator("form").getByRole("alert");
const offlineCheckbox = (page: Page) =>
  page.getByRole("checkbox", { name: "Offline", exact: true });
/** The form's breadcrumb: a "Notification" button back to the list, then the page itself. */
const formBreadcrumbPage = (page: Page, title: string) =>
  page
    .getByRole("navigation", { name: "breadcrumb" })
    .filter({ has: page.getByRole("button", { name: "Notification", exact: true }) })
    .getByRole("link", { name: title, exact: true });
// The filter toolbar renders a second, hidden copy of the search box (other layout).
const searchInput = (page: Page) =>
  page.getByPlaceholder("Search by name").filter({ visible: true });

export async function navigateToNotificationFlow(page: Page) {
  await openSecretManagement(page, "notification", "Notification");
}

/** The list settles on either the empty state or the table with its Recipients column. */
export async function verifyEmptyStateFlow(page: Page) {
  const empty = page.getByText("No notifications yet", { exact: true });
  // The header's name includes its help button's label.
  const table = page.getByRole("columnheader", {
    name: "Recipients What recipients mean",
    exact: true,
  });
  await expect(empty.or(table)).toBeVisible({ timeout: 30000 });
}

export async function openAddNotificationDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add notification", exact: true }).click();
  await expect(page.getByRole("heading", { name: "New notification", level: 1 })).toBeVisible({
    timeout: 15000,
  });
  await expect(formBreadcrumbPage(page, "New notification")).toHaveAttribute(
    "aria-current",
    "page",
  );
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

  const projectUsers = page.getByRole("checkbox", { name: "Consumer users", exact: true });
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

/** Saves a custom notification sent to all consumer users, in-app and kept for offline users. */
export async function fillAndSaveNotificationConfigFlow(page: Page, configName: string) {
  await eventNameInput(page).fill(configName);
  await page.getByRole("button", { name: "All users", exact: true }).click();
  await expect(page.getByRole("button", { name: "All users", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await offlineCheckbox(page).click();
  await expect(offlineCheckbox(page)).toBeChecked();

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
  // Recipients: who gets it, above the audience (the old Receivers and Send to columns).
  await expect(cells.nth(1).getByText("All users", { exact: true })).toBeVisible();
  await expect(cells.nth(1).getByText("Consumer users", { exact: true })).toBeVisible();
  const channels = cells.nth(4); // Delivery channels: one named icon per channel
  await expect(channels.getByTitle("In-app: on", { exact: true })).toBeVisible();
  await expect(channels.getByTitle("Push: off", { exact: true })).toBeVisible();
  await expect(channels.getByTitle("Offline: on", { exact: true })).toBeVisible();
  await expect(cells.nth(5)).toHaveText("Active");
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
  await expect(formBreadcrumbPage(page, configName)).toHaveAttribute("aria-current", "page");
  await expect(eventNameInput(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "All users", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(offlineCheckbox(page)).toBeChecked();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(configRow).toBeVisible({ timeout: 15000 });
}

export async function editNotificationConfigAndSaveFlow(
  page: Page,
  configRow: Locator,
  configName: string,
) {
  await openEditFromRowFlow(page, configRow, configName);
  // "Affected users only" is now Targeted with only the Owner tick (8f8cca6d, 61d927b0).
  const targeted = page.getByRole("button", { name: "Targeted", exact: true });
  await targeted.click();
  await expect(targeted).toHaveAttribute("aria-pressed", "true");
  const owner = page.getByRole("checkbox", { name: "Owner", exact: true });
  await expect(owner).not.toBeChecked();
  await owner.click();
  await expect(owner).toBeChecked();
  const save = saveButton(page);
  await expect(save).toBeEnabled({ timeout: 10000 });
  await save.click();
  await expect(page.getByText("Configuration updated successfully.", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await expect(
    configRow.getByRole("cell").nth(1).getByText("Targeted: owner", { exact: true }),
  ).toBeVisible({
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

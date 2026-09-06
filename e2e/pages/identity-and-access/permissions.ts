import { expect, type Page } from "@playwright/test";
import { openIam } from "../../support/os-helpers";

export async function navigateToPermissionsFlow(page: Page) {
  await openIam(page, "permission", "Permissions");
  await expect(page.getByRole("button", { name: "Add Permission" })).toBeVisible({
    timeout: 30_000,
  });
}

export async function openNewPermissionPageFlow(page: Page) {
  await page.getByRole("button", { name: "Add Permission" }).click();
  await expect(page).toHaveURL(/\/iam\/permission-detail\/new/, { timeout: 15_000 });
  // "New Permission" renders as plain text, not a heading role.
  await expect(page.getByText("New Permission", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder("Enter name")).toBeVisible();
}

export async function strictValidationFlow(page: Page) {
  const nameInput = page.getByPlaceholder("Enter name");
  await nameInput.fill("x");
  await nameInput.fill("");
  // The deployed form surfaces required-field errors on Save click, not on
  // field-blur — click Save first, then assert each required-but-empty field
  // surfaces its error.
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText("Name is required")).toBeVisible();
  await expect(page.getByText("Type is required")).toBeVisible();
  await expect(page.getByText("Resource is required")).toBeVisible();
  await expect(page.getByText("Group is required")).toBeVisible();
}

export async function selectTypeFlow(page: Page, typeName: string) {
  // Comboboxes appear in DOM/form order: Type, Group, Severity
  // (permission-form.tsx's FormField order) — use position rather than
  // hasText, since the trigger's own text changes the instant a value
  // is picked and a hasText-filtered locator re-evaluates live against
  // that new text on every subsequent use.
  const comboboxes = page.getByRole("combobox");
  const typeSelect = comboboxes.nth(0);
  await typeSelect.click();
  await page.getByRole("option", { name: typeName, exact: true }).click();
  await expect(typeSelect).toHaveText(typeName);
}

export async function selectExistingGroupFlow(page: Page, groupName: string) {
  const comboboxes = page.getByRole("combobox");
  const groupCombobox = comboboxes.nth(1);
  await groupCombobox.click();
  const groupSearchInput = page.getByPlaceholder("Search or create a group...");
  await expect(groupSearchInput).toBeVisible({ timeout: 10_000 });
  await groupSearchInput.fill(groupName);
  const existingOption = page.getByRole("option", { name: groupName, exact: true });
  // isVisible({ timeout }) returns false on timeout without throwing,
  // so a plain if-check is sufficient — no .catch needed.
  if (await existingOption.isVisible({ timeout: 5_000 })) {
    await existingOption.click();
    await expect(groupCombobox).toHaveText(groupName, { timeout: 10_000 });
    return true;
  }
  // No exact match -> clear and fall back to create path
  await groupSearchInput.fill("");
  return false;
}

export async function createNewGroupFlow(page: Page, groupName: string) {
  const comboboxes = page.getByRole("combobox");
  const groupCombobox = comboboxes.nth(1);
  await groupCombobox.click();
  const groupSearchInput = page.getByPlaceholder("Search or create a group...");
  await expect(groupSearchInput).toBeVisible({ timeout: 10_000 });
  await groupSearchInput.fill(groupName);
  const createGroupOption = page.getByRole("option", {
    name: new RegExp(`Create group.*${groupName}`),
  });
  await expect(createGroupOption).toBeVisible({ timeout: 10_000 });
  await createGroupOption.click();
  await expect(groupCombobox).toHaveText(groupName, { timeout: 10_000 });
}

export async function selectSeverityFlow(page: Page, severityName: string) {
  const comboboxes = page.getByRole("combobox");
  const severitySelect = comboboxes.nth(2);
  await expect(severitySelect).toBeVisible({ timeout: 5_000 });
  await severitySelect.click();
  const severityOption = page.getByRole("option", { name: severityName, exact: true });
  // Strict: the requested severity MUST be available. Silent fall-through
  // to "first option" would mask a missing-severity regression.
  await expect(severityOption).toBeVisible({ timeout: 5_000 });
  await severityOption.click();
  await expect(severitySelect).toHaveText(severityName);
}

export async function savePermissionFlow(page: Page) {
  const saveButton = page.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeEnabled({ timeout: 10_000 });
  await saveButton.click();

  // The toast text also gets echoed inside an aria-live status region,
  // so scope to the exact toast body node.
  await expect(page.getByText("Permission created successfully", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page).toHaveURL(/\/iam\/permissions/, { timeout: 15_000 });
}

export async function createCustomPermissionFlow(
  page: Page,
  permissionName: string,
  resourceId: string,
  typeName: string,
  groupName: string,
  severityName: string,
) {
  await page.getByPlaceholder("Enter name").fill(permissionName);

  await selectTypeFlow(page, typeName);

  const resourceInput = page.getByPlaceholder(/Enter resource|service::controller::name/);
  await resourceInput.fill(resourceId);

  await createNewGroupFlow(page, groupName);
  await selectSeverityFlow(page, severityName);

  await savePermissionFlow(page);
}

export async function openCustomPermissionDetailsFlow(page: Page, permissionName: string) {
  // The list page renders each permission as a <div role="button" aria-label="Open permission {name}">,
  // NOT as a table <tr>. Targeting the aria-label is more specific than
  // getByRole("row") which doesn't match here at all.
  const permissionRow = page.getByRole("button", {
    name: `Open permission ${permissionName}`,
  });
  const searchInput = page.getByPlaceholder("Search...").first();

  // First attempt: search input visible -> fill it.
  if (await searchInput.isVisible({ timeout: 5_000 })) {
    await searchInput.fill(permissionName);
  }

  // Strict: the row MUST be visible within the budget. If it's not,
  // reload once and retry — but the row MUST surface after that retry.
  if (!(await permissionRow.isVisible({ timeout: 15_000 }))) {
    await page.reload({ waitUntil: "domcontentloaded" });
    const searchInputAfterReload = page.getByPlaceholder("Search...").first();
    await expect(searchInputAfterReload).toBeVisible({ timeout: 10_000 });
    await searchInputAfterReload.fill(permissionName);
    await expect(permissionRow).toBeVisible({ timeout: 15_000 });
  }

  await expect(permissionRow.getByText("Custom")).toBeVisible();

  await permissionRow.click();
  await expect(page).toHaveURL(/\/iam\/permission-detail\/.+/, { timeout: 15_000 });
  await expect(page.getByText(permissionName).first()).toBeVisible({ timeout: 15_000 });
}

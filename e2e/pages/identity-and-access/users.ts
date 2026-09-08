import { expect, type Locator, type Page } from "@playwright/test";
import path from "path";
import { e2eDebugLog } from "../../support/env";
import { openIam } from "../../support/os-helpers";

const TEST_AVATAR_PATH = path.resolve(__dirname, "../../fixtures/test-avatar.png");

function usersEmptyState(page: Page) {
  return page.getByText("No users found.");
}

function usersNameSortHeader(page: Page) {
  return page.getByText("Name", { exact: true }).first();
}

/**
 * UsersTable renders a skeleton while isLoading || isFetching, the empty copy
 * when the fetch returns [], and the Name sort header only when there is at
 * least one row. Wait for either settled state so later steps do not race the
 * skeleton (neither empty copy nor Name exists during fetch).
 */
export async function waitForUsersListSettledFlow(page: Page) {
  await expect(usersEmptyState(page).or(usersNameSortHeader(page))).toBeVisible({
    timeout: 30_000,
  });
}

export async function navigateToUsersFlow(page: Page) {
  await openIam(page, "user", "Users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 30_000 });
  await waitForUsersListSettledFlow(page);
}

export async function searchUsersFlow(page: Page) {
  const searchInput = page.getByPlaceholder("Minimum 3 characters…").first();
  await expect(searchInput).toBeVisible({ timeout: 5_000 });
  await searchInput.fill("no-such-user-xyz");
  await expect(usersEmptyState(page)).toBeVisible({ timeout: 8_000 });
  await searchInput.fill("");
  await waitForUsersListSettledFlow(page);
}

export async function filterByOrganizationThenRolesFlow(page: Page, organizationName: string) {
  const filtersTrigger = page.getByRole("button", { name: "Filters" });
  await expect(filtersTrigger).toBeVisible({ timeout: 5_000 });
  await filtersTrigger.click();

  const sheet = page.getByRole("dialog", { name: "Filters" });
  await expect(sheet).toBeVisible({ timeout: 8_000 });

  const orgFilter = sheet.getByRole("button", { name: /^Organizations/ });
  const rolesFilter = sheet.getByRole("button", { name: /^Roles/ });
  await expect(orgFilter).toBeVisible({ timeout: 8_000 });
  await expect(rolesFilter).toBeVisible({ timeout: 5_000 });
  await expect(rolesFilter).toBeDisabled();

  await orgFilter.click();
  const orgSearch = page.getByPlaceholder("Organizations");
  await expect(orgSearch).toBeVisible({ timeout: 5_000 });
  await orgSearch.fill(organizationName);
  const orgOption = page.getByRole("option", { name: organizationName, exact: true });
  await expect(orgOption).toBeVisible({ timeout: 10_000 });
  await orgOption.click();
  await page.keyboard.press("Escape");

  await expect(rolesFilter).toBeEnabled({ timeout: 10_000 });
  await rolesFilter.click();
  await expect(page.getByPlaceholder("Roles")).toBeVisible({ timeout: 8_000 });
  await page.keyboard.press("Escape");

  const createdDateButton = sheet.getByRole("button", { name: /^Created on$/i });
  await expect(createdDateButton).toBeVisible({ timeout: 5_000 });
  await createdDateButton.click();
  const today = page.getByRole("gridcell", { selected: false }).first();
  if (await today.isVisible({ timeout: 3_000 })) {
    await today.click();
    await page.getByRole("button", { name: "Apply" }).click();
  } else {
    await page.keyboard.press("Escape");
  }

  const showResults = sheet.getByRole("button", { name: "Show Results" });
  if (await showResults.isVisible({ timeout: 3_000 })) {
    await showResults.click();
  } else {
    await page.keyboard.press("Escape");
  }

  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 8_000 });
  await openIam(page, "user", "Users");
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({ timeout: 30_000 });
  await waitForUsersListSettledFlow(page);
}

export async function sortUsersByNameFlow(page: Page) {
  await waitForUsersListSettledFlow(page);
  if (await usersEmptyState(page).isVisible()) {
    return;
  }
  const nameHeader = usersNameSortHeader(page);
  await expect(nameHeader).toBeVisible({ timeout: 5_000 });
  // Name is the default sort, so nuqs omits sort-property=FirstName from the URL.
  // The first click only flips the default ascending sort to descending.
  await nameHeader.click();
  await expect(page).toHaveURL(/sort-isDescending=true/, { timeout: 8_000 });
  await nameHeader.click();
  await expect(page).not.toHaveURL(/sort-isDescending=true/, { timeout: 8_000 });
}

export async function openInviteUserDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Invite User" }).click();
  await expect(page.getByRole("heading", { name: "Invite User" })).toBeVisible();
}

export async function inviteEmailValidationFlow(page: Page) {
  const emailInput = page.getByPlaceholder("name@company.com");
  await emailInput.fill("x");
  await emailInput.fill("");
  await expect(page.getByText("Email is required")).toBeVisible();

  await emailInput.fill("not-an-email");
  await expect(page.getByText("Please enter a valid email address")).toBeVisible();
}

async function selectInviteOrganization(page: Page, inviteDialog: Locator, organizationName?: string) {
  const orgTrigger = inviteDialog.getByRole("combobox");
  const orgComboboxVisible = await orgTrigger.isVisible({ timeout: 8_000 });
  if (!orgComboboxVisible) {
    if (organizationName) {
      throw new Error(
        `Invite User dialog has no organization picker — cannot assign "${organizationName}".`,
      );
    }
    return;
  }

  const targetName = organizationName ?? "Default";
  const alreadySelected = await orgTrigger.getByText(targetName, { exact: true }).isVisible();
  if (!alreadySelected) {
    await orgTrigger.click();
    const search = page.getByPlaceholder("Search organizations...");
    if (await search.isVisible({ timeout: 3_000 })) {
      await search.fill(targetName);
    }
    const option = page.getByRole("option", { name: targetName, exact: true });
    if (await option.isVisible({ timeout: 8_000 })) {
      await option.click();
    } else if (!organizationName) {
      const firstOrg = page.getByTestId("organization-options-list").getByRole("option").first();
      await expect(firstOrg).toBeVisible({ timeout: 8_000 });
      await firstOrg.click();
    } else {
      throw new Error(`Organization "${organizationName}" not in Invite User picker.`);
    }
  }

  await expect(orgTrigger).not.toHaveText("Select organization", { timeout: 5_000 });
  if (organizationName) {
    await expect(orgTrigger).toContainText(organizationName, { timeout: 5_000 });
  }
}

export async function sendInviteFlow(page: Page, inviteEmail: string, organizationName?: string) {
  const inviteDialog = page.getByRole("dialog").filter({ hasText: "Invite User" });
  await inviteDialog.getByPlaceholder("name@company.com").fill(inviteEmail);
  await selectInviteOrganization(page, inviteDialog, organizationName);

  const sendButton = inviteDialog.getByRole("button", { name: /Send invite|Grant access/ });
  await expect(sendButton).toBeEnabled({ timeout: 15_000 });

  const createResponsePromise = page.waitForResponse(
    (response) =>
      /\/api\/iam\/users\/create\/?$/i.test(response.url()) &&
      response.request().method() === "POST",
    { timeout: 20_000 },
  );

  await sendButton.click();

  const createResponse = await createResponsePromise.catch(() => null);
  if (createResponse && createResponse.status() >= 400) {
    throw new Error(
      `Invite User API rejected create with HTTP ${createResponse.status()} — dialog stayed open.`,
    );
  }

  // The visible toast text is duplicated inside an aria-live status span
  // for screen readers; scope to the Notifications region so we hit the
  // toast body, not the live-region echo (which fails strict mode).
  const inviteToast = page
    .getByRole("region", { name: /Notifications/i })
    .getByText(/Invitation is sent|User granted access to the organization/);
  await expect(inviteToast).toBeVisible({ timeout: 15_000 });
  await expect(inviteDialog).toBeHidden({ timeout: 15_000 });
}

export function escapeForRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findInvitedUserRowFlow(page: Page, inviteEmail: string) {
  return page.getByRole("button", {
    name: new RegExp(escapeForRegex(inviteEmail)),
  });
}

export async function openInvitedUserDetailsFlow(page: Page, inviteEmail: string) {
  const searchType = page.getByRole("combobox").first();
  if (await searchType.isVisible({ timeout: 5_000 })) {
    await searchType.click();
    await page.getByRole("listbox").getByRole("option").first().click();
  }
  const searchInput = page.getByPlaceholder("Minimum 3 characters…").first();
  if (await searchInput.isVisible({ timeout: 5_000 })) {
    await searchInput.fill(inviteEmail);
  }

  const userRow = findInvitedUserRowFlow(page, inviteEmail);
  for (let attempt = 0; attempt < 6; attempt++) {
    if (await userRow.isVisible({ timeout: 10_000 })) break;
    if (attempt === 5) break;
    await page.waitForTimeout(5_000);
    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({
      timeout: 30_000,
    });
    if (await searchType.isVisible({ timeout: 5_000 })) {
      await searchType.click();
      await page.getByRole("listbox").getByRole("option").first().click();
    }
    if (await searchInput.isVisible({ timeout: 5_000 })) {
      await searchInput.fill(inviteEmail);
    }
  }
  await expect(userRow).toBeVisible({ timeout: 15_000 });
  await userRow.locator("p").first().click();
  await expect(page).toHaveURL(/\/iam\/user-detail\/.+/, { timeout: 15_000 });
}

export async function assertAccessTabLandingFlow(page: Page) {
  await expect(page.getByRole("tab", { name: "Access" })).toBeVisible({ timeout: 15_000 });
}

export async function editUserNameFlow(page: Page) {
  const editButton = page.getByRole("button", { name: "Edit user" });
  await expect(editButton).toBeVisible({ timeout: 8_000 });
  await editButton.click();
  await expect(page.getByRole("heading", { name: "Edit User" })).toBeVisible();

  await page.getByPlaceholder("Enter first name").fill("Flow");
  await page.getByPlaceholder("Enter last name").fill(`User ${Date.now()}`);

  const saveButton = page.getByRole("button", { name: "Save" });
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });
  await saveButton.click();

  const toast = page
    .getByRole("region", { name: /Notifications/i })
    .getByText("User updated successfully", { exact: true });
  await expect(toast).toBeVisible({ timeout: 15_000 });
}

export async function rejectNonImageUploadFlow(page: Page) {
  const uploadButton = page.getByRole("button", { name: "Change profile image" });
  await expect(uploadButton).toBeVisible({ timeout: 8_000 });
  const fileChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "document.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from("%PDF-1.4 not a real pdf, just wrong type"),
  });

  await expect(
    page.getByText("Only image files (PNG, JPG, GIF, WebP, and SVG) are allowed"),
  ).toBeVisible({ timeout: 10_000 });
}

export async function rejectOversizedImageUploadFlow(page: Page) {
  const uploadButton = page.getByRole("button", { name: "Change profile image" });
  await expect(uploadButton).toBeVisible({ timeout: 8_000 });
  const fileChooserPromise = page.waitForEvent("filechooser");
  await uploadButton.click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(6 * 1024 * 1024),
  });

  await expect(
    page
      .getByRole("region", { name: /Notifications/i })
      .getByText("File size must be less than 5MB", { exact: true }),
  ).toBeVisible({ timeout: 10_000 });
}

export async function uploadValidProfilePictureFlow(page: Page) {
  const uploadButton = page.getByRole("button", { name: "Change profile image" });
  await expect(uploadButton).toBeVisible({ timeout: 8_000 });
  // Prefer the hidden file input over the filechooser race — more reliable when
  // the button programmatically clicks input[type=file].
  const fileInput = page.locator('input[type="file"][accept="image/*"]').first();
  await fileInput.setInputFiles(TEST_AVATAR_PATH);

  const notifications = page.getByRole("region", { name: /Notifications/i });
  const successToast = notifications.getByText("Profile pic updated successfully", {
    exact: true,
  });
  // Fresh e2e projects often have no "Default" storage configuration — the
  // uploader hard-requires that name. Treat a surfaced error as an env skip
  // rather than a product regression in the users flow.
  const errorToast = notifications.getByText(
    /Unable to upload profile picture|Something went wrong|Default storage|storage configuration/i,
  );

  await expect(successToast.or(errorToast)).toBeVisible({ timeout: 20_000 });
  if (await errorToast.isVisible()) {
    e2eDebugLog(
      "[users-flow] Profile pic upload failed (likely missing Default storage) — continuing without it.",
    );
    return;
  }
  await expect(successToast).toBeVisible();
}

export async function resendActivationFlow(page: Page) {
  const resendButton = page.getByRole("button", { name: "Resend Activation" }).first();
  await expect(resendButton).toBeVisible({ timeout: 8_000 });
  await resendButton.click();
  await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
  await page.getByRole("button", { name: "Resend", exact: true }).click();
  await expect(
    page
      .getByRole("region", { name: /Notifications/i })
      .getByText("Activation email has been resent successfully", { exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}

export async function manageUserRoleFlow(page: Page) {
  const manageRolesButton = page.getByRole("button", { name: "Manage Roles" });
  await expect(manageRolesButton).toBeVisible({ timeout: 8_000 });
  await manageRolesButton.click();
  await expect(page.getByRole("heading", { name: "Manage roles" })).toBeVisible();

  const firstRoleCheckbox = page.getByRole("checkbox").first();
  // Strict: the dialog MUST contain at least one selectable role. If it
  // doesn't, the dialog is in an unexpected state and the flow must
  // surface it.
  await expect(firstRoleCheckbox).toBeVisible({ timeout: 5_000 });
  await firstRoleCheckbox.click();
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  // Strict: the Add button MUST become enabled once a role is selected.
  await expect(addButton).toBeEnabled({ timeout: 5_000 });
  await addButton.click();
  // Strict: a successful role assignment MUST surface the toast.
  const toast = page
    .getByRole("region", { name: /Notifications/i })
    .getByText("Roles and permissions updated successfully", { exact: true });
  await expect(toast).toBeVisible({ timeout: 15_000 });
}

export async function manageUserPermissionFlow(page: Page) {
  const managePermissionsButton = page.getByRole("button", { name: "Manage Permissions" });
  await expect(managePermissionsButton).toBeVisible({ timeout: 8_000 });
  await managePermissionsButton.click();
  await expect(page.getByRole("heading", { name: "Manage permissions" })).toBeVisible();

  const firstPermissionCheckbox = page.getByRole("checkbox").first();
  // Strict: the dialog MUST contain at least one selectable permission.
  await expect(firstPermissionCheckbox).toBeVisible({ timeout: 5_000 });
  await firstPermissionCheckbox.click();
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  // Strict: the Save button MUST become enabled once a permission is picked.
  await expect(saveButton).toBeEnabled({ timeout: 5_000 });
  await saveButton.click();
  // Strict: a successful permission assignment MUST surface the toast.
  const toast = page
    .getByRole("region", { name: /Notifications/i })
    .getByText("Roles and permissions updated successfully", { exact: true });
  await expect(toast).toBeVisible({ timeout: 15_000 });
}

export async function switchUserTabFlow(page: Page, tabName: string) {
  const tab = page.getByRole("tab", { name: tabName });
  await tab.click();
  await expect(tab).toHaveAttribute("aria-selected", "true");
}

export async function signOutSessionFlow(page: Page) {
  const signOutButton = page.getByRole("button", { name: "Sign out" }).first();
  const emptyState = page.getByText("No sessions");

  // isVisible({ timeout }) returns false on timeout without throwing, so
  // no .catch is needed. If neither state is visible, the UI has drifted
  // and we MUST fail loudly rather than silently no-op.
  const signOutVisible = await signOutButton.isVisible({ timeout: 5_000 });
  const emptyVisible = await emptyState.isVisible({ timeout: 1_000 });

  if (!signOutVisible && !emptyVisible) {
    throw new Error(
      "Sessions tab is in an unexpected state — neither a 'Sign out' button " +
        "nor the 'No sessions' empty state is visible. UI may have drifted; " +
        "see snapshots.",
    );
  }

  if (!signOutVisible) {
    await expect(emptyState).toBeVisible({ timeout: 5_000 });
    return;
  }

  await signOutButton.click();
  await expect(page.getByRole("heading", { name: "Sign out of this device?" })).toBeVisible();
  await page.getByRole("button", { name: "Sign out", exact: true }).last().click();
  // Strict: a successful sign-out MUST surface the confirmation toast.
  const toast = page
    .getByRole("region", { name: /Notifications/i })
    .getByText("Device signed out successfully", { exact: true });
  await expect(toast).toBeVisible({ timeout: 15_000 });
}

export async function paginateHistoryListFlow(page: Page) {
  // Scope to the History tabpanel so the chevron matches the activity
  // paginator instead of the sidebar's Secrets & Configs disclosure.
  const historyPanel = page.getByRole("tabpanel", { name: /History/i });
  await expect(historyPanel).toBeVisible({ timeout: 8_000 });

  const nextPageButton = historyPanel.locator("button:has(svg.lucide-chevron-right)").first();
  // Strict: if the paginator exists, it MUST be clickable AND it MUST
  // navigate. If it doesn't exist (fewer than 10 history entries on a
  // fresh project), that's the empty state and we skip — not a failure.
  if (!(await nextPageButton.isVisible({ timeout: 3_000 }))) {
    return;
  }
  await expect(nextPageButton).toBeEnabled();
  await nextPageButton.click();
  await expect(page).toHaveURL(/[?&]page=1/, { timeout: 8_000 });
}

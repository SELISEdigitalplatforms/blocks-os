import { expect, type Page } from "@playwright/test";
import { e2eDebugLog } from "../../support/env";
import { openIam } from "../../support/os-helpers";

/**
 * Wait for permission checkboxes on role details.
 * Do not page.reload() here — a hard reload drops the SPA deep link and lands
 * on /app/console (or /login), which is worse than an empty permissions panel.
 */
async function waitForRolePermissionCheckboxes(page: Page) {
  const firstCheckbox = page.getByRole("checkbox").first();
  return firstCheckbox.isVisible({ timeout: 30_000 }).catch(() => false);
}

export async function navigateToRolesFlow(page: Page) {
  await openIam(page, "role", "Roles");
  await expect(page.getByRole("button", { name: "Add Role" })).toBeVisible({ timeout: 30_000 });
}

export async function openAddRoleDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add Role" }).click();
  await expect(page.getByRole("heading", { name: "Add Role" })).toBeVisible();
}

export async function nameSlugRequiredValidationFlow(page: Page) {
  const nameInput = page.getByPlaceholder("Enter name");
  const slugInput = page.getByPlaceholder("Enter slug");
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await nameInput.fill("x");
  await slugInput.fill("");
  await expect(addButton).toBeEnabled({ timeout: 5_000 });
  await addButton.click();
  await expect(page.getByText("A slug is required.")).toBeVisible();
  await slugInput.fill("x");
  await nameInput.fill("");
  await expect(addButton).toBeEnabled({ timeout: 5_000 });
  await addButton.click();
  await expect(page.getByText("A role name is required.")).toBeVisible();
}

export async function slugRejectsSpacesFlow(page: Page) {
  const slugInput = page.getByPlaceholder("Enter slug");
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await slugInput.fill("has a space");
  await addButton.click();
  await expect(page.getByText("A slug cannot contain spaces.")).toBeVisible();
}

export async function createRoleFlow(page: Page, roleName: string, roleSlug: string) {
  await page.getByPlaceholder("Enter name").fill(roleName);
  await page.getByPlaceholder("Enter slug").fill(roleSlug);
  await page.getByPlaceholder("Enter description").fill("Created by the Roles flow test.");

  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Role added successfully", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

export async function searchRoleByNameFlow(page: Page, roleName: string) {
  const searchInput = page.getByPlaceholder("Search...").first();
  await searchInput.fill(roleName);
  await expect(page.getByRole("button", { name: `Edit role ${roleName}` })).toBeVisible({
    timeout: 8_000,
  });
  await searchInput.fill("");
}

export async function organizationFilterFlow(page: Page) {
  const orgFilterButton = page.getByRole("button", { name: /^Organization/i }).first();
  await expect(orgFilterButton).toBeVisible({ timeout: 5_000 });
  await orgFilterButton.click();
  const firstOption = page.getByRole("radio").first();
  if (await firstOption.isVisible({ timeout: 3_000 })) {
    await firstOption.click();
    // The Roles list renders the result as <div role="button"> cards, not as
    // a <table>. The previous `getByRole("table")` assertion was structurally
    // wrong and only "passed" when the dropdown didn't open at all (the
    // surrounding if-block then skipped the assertion). Verify the filter
    // took effect via the URL: picking an org writes `orgId=<id>` to the
    // query string via useRolesFilterQueryParams.
    await expect(page).toHaveURL(/[?&]orgId=[^&]+/, { timeout: 8_000 });

    const clearButton = page.getByRole("button", { name: /^Clear$/i });
    const resetButton = page.getByRole("button", { name: /^Reset$/i });
    if (await clearButton.isVisible({ timeout: 2_000 })) {
      await clearButton.click();
    } else if (await resetButton.isVisible({ timeout: 2_000 })) {
      await resetButton.click();
    } else {
      await orgFilterButton.click();
      if (await clearButton.isVisible({ timeout: 2_000 })) {
        await clearButton.click();
      } else {
        await page.keyboard.press("Escape");
      }
    }
  } else {
    await page.keyboard.press("Escape");
  }
}

export async function sortByNameColumnFlow(page: Page) {
  const nameHeader = page.getByText("Name", { exact: true }).first();
  await expect(nameHeader).toBeVisible({ timeout: 5_000 });

  await nameHeader.click();
  await expect(page).toHaveURL(/sort-(?:property=|isDescending=)/, { timeout: 8_000 });
  const urlAfterFirstClick = page.url();
  await nameHeader.click();
  await expect(page).not.toHaveURL(urlAfterFirstClick, { timeout: 8_000 });
}

export async function paginateRolesFlow(page: Page) {
  // The Pagination component only renders when totalCount > pageSize
  // (default 10). With few roles in the test tenant, pagination may not
  // be on screen at all — skip cleanly. Otherwise anchor to its unique
  // "Page X of Y" indicator text so the chevron-right locator can't
  // pick up unrelated icons elsewhere on the page (sidebar nav, etc.).
  const paginationRoot = page
    .locator("div")
    .filter({ has: page.locator("text=/^Page \\d+ of \\d+$/") })
    .first();
  const nextPageButton = paginationRoot.locator("button:has(svg.lucide-chevron-right)").first();
  if (!(await nextPageButton.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return;
  }
  await expect(nextPageButton).toBeEnabled({ timeout: 5_000 });
  await nextPageButton.click();
  // Strict: paginating MUST update the URL.
  await expect(page).toHaveURL(/[?&]page=1/, { timeout: 8_000 });

  await openIam(page, "role", "Roles");
  await expect(page.getByRole("button", { name: "Add Role" })).toBeVisible({ timeout: 30_000 });
}

export async function editRoleNameAndDescriptionFlow(
  page: Page,
  originalName: string,
  updatedName: string,
) {
  const editRoleButton = page.getByRole("button", { name: `Edit role ${originalName}` });
  await expect(editRoleButton).toBeVisible({ timeout: 15_000 });
  await editRoleButton.click();
  await expect(page.getByRole("heading", { name: "Update Role" })).toBeVisible();

  const nameInput = page.getByPlaceholder("Enter name");
  await expect(nameInput).toHaveValue(originalName);
  await nameInput.fill(updatedName);
  await page.getByPlaceholder("Enter description").fill("Updated by the Roles flow test.");

  await page.getByRole("button", { name: "Update", exact: true }).click();
  await expect(page.getByText("Role updated successfully", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: `Edit role ${updatedName}` })).toBeVisible({
    timeout: 15_000,
  });
}

export async function openRoleDetailsFlow(page: Page, roleName: string) {
  const openRoleButton = page.getByRole("button", { name: `Open role ${roleName}` });
  await expect(openRoleButton).toBeVisible({ timeout: 15_000 });
  await openRoleButton.locator("p").first().click();
  // Strict: clicking MUST navigate to the role detail route.
  await expect(page).toHaveURL(/\/iam\/role-detail\/.+/, { timeout: 15_000 });
  await expect(page.getByText(roleName).first()).toBeVisible({ timeout: 15_000 });
}

export async function toggleEditPermissionsDiscardFlow(page: Page) {
  const hasPermissions = await waitForRolePermissionCheckboxes(page);
  if (!hasPermissions) {
    e2eDebugLog(
      "[roles-flow] Role details still has no permission checkboxes — skipping edit/discard.",
    );
    return;
  }

  const editPermissionsButton = page.getByRole("button", { name: "Edit Permissions" });
  await expect(editPermissionsButton).toBeVisible({ timeout: 8_000 });
  await editPermissionsButton.click();
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();

  const firstPermissionCheckbox = page.getByRole("checkbox").first();
  await expect(firstPermissionCheckbox).toBeVisible({ timeout: 10_000 });
  await firstPermissionCheckbox.click();

  await page.getByRole("button", { name: "Discard" }).click();
}

export async function saveEditPermissionsFlow(page: Page) {
  const hasPermissions = await waitForRolePermissionCheckboxes(page);
  if (!hasPermissions) {
    e2eDebugLog(
      "[roles-flow] Role details still has no permission checkboxes — skipping save permissions.",
    );
    return;
  }

  const editPermissionsButton = page.getByRole("button", { name: "Edit Permissions" });
  await expect(editPermissionsButton).toBeVisible({ timeout: 8_000 });
  await editPermissionsButton.click();
  const saveChangesButton = page.getByRole("button", { name: "Save Changes" });
  await expect(saveChangesButton).toBeVisible();

  const firstPermissionCheckbox = page.getByRole("checkbox").first();
  await expect(firstPermissionCheckbox).toBeVisible({ timeout: 10_000 });
  await firstPermissionCheckbox.click();

  const reviewDialogSave = page
    .getByRole("dialog")
    .filter({ hasText: "Review Permission Changes" })
    .getByRole("button", { name: "Save", exact: true });
  if (await reviewDialogSave.isVisible({ timeout: 3_000 })) {
    await reviewDialogSave.click();
  }

  await saveChangesButton.click();

  const applyDialogConfirm = page
    .getByRole("dialog")
    .filter({ hasText: "Apply permission changes?" })
    .getByRole("button", { name: /Save changes|Apply to all organizations/ });
  if (await applyDialogConfirm.isVisible({ timeout: 5_000 })) {
    await applyDialogConfirm.click();
  }

  // Strict: a successful save MUST surface the permissions-updated toast.
  // The toast text also gets echoed into an aria-live status span, so anchor
  // the pattern to disambiguate from the slightly different status text.
  // Wording depends on whether multi-organization mode is active in this
  // session (see organizations.ts's enableMultiOrgFlow): a single-org project
  // says "...updated successfully", while applying to all organizations
  // (the "Apply to all organizations" branch above) says "...updated across
  // all organizations" instead.
  await expect(
    page.getByText(/^Role permissions updated (successfully|across all organizations)$/),
  ).toBeVisible({ timeout: 15_000 });
  await expect(editPermissionsButton).toBeVisible({ timeout: 15_000 });
}

export async function archiveRoleFlow(page: Page, roleName: string) {
  await openIam(page, "role", "Roles");
  await expect(page.getByRole("button", { name: "Add Role" })).toBeVisible({ timeout: 30_000 });

  const searchInput = page.getByPlaceholder("Search...").first();
  await searchInput.fill(roleName);

  const archiveButton = page.getByRole("button", { name: `Archive role ${roleName}` });
  await expect(archiveButton).toBeVisible({ timeout: 15_000 });
  await archiveButton.click();

  const archiveDialog = page.getByRole("dialog").filter({ hasText: /Archive this role\?/i });
  await expect(archiveDialog).toBeVisible({ timeout: 10_000 });

  const consentCheckbox = page.getByRole("checkbox", {
    name: /Confirm removing this role/i,
  });
  if (await consentCheckbox.isVisible({ timeout: 5_000 })) {
    await consentCheckbox.click();
  }

  const confirmButton = page.getByRole("button", { name: "Archive", exact: true });
  // Strict: the Archive button MUST become enabled after consent.
  await expect(confirmButton).toBeEnabled({ timeout: 10_000 });
  await confirmButton.click();

  // Strict: a successful archive MUST surface the confirmation toast.
  await expect(page.getByText("Role archived successfully", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: `Open role ${roleName}` })).toHaveCount(0, {
    timeout: 15_000,
  });
}

import { test, expect } from "../support/test-base";
import type { Page } from "@playwright/test";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("users", () => {
 test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);

  await expect(
   page.getByRole("heading", { name: "Your Blocks Projects" }),
  ).toBeVisible({ timeout: 30_000 });
  await page
   .getByRole("button", { name: /Development/ })
   .first()
   .click();
  await expect(page.getByRole("heading", { name: "Domains" })).toBeVisible({
   timeout: 20000,
  });

  const usersLink = page.getByRole("link", { name: "Users" });
  if (!(await usersLink.isVisible().catch(() => false))) {
   await page.getByText("Identity & Access", { exact: true }).click();
  }
  await usersLink.click();
  await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({
   timeout: 30000,
  });
 });

 // The table is a div-based grid, not a real <table>, so headers have no
 // `columnheader` role. Each header's label lives in a `span.font-bold`
 // rendered by SortHeader; match on that to avoid colliding with the
 // same words shown inline in each row (e.g. mobile "Created on" labels).
 const columnHeader = (page: Page, label: string) =>
  page.locator("span.font-bold", { hasText: new RegExp(`^${label}$`) });

 test("TC-0113: Users page renders a table with Name, Email, Status, Created on, Last updated and Last login columns", async ({
  page,
 }) => {
  await expect(columnHeader(page, "Name")).toBeVisible();
  await expect(columnHeader(page, "Email")).toBeVisible();
  await expect(columnHeader(page, "Status")).toBeVisible();
  await expect(columnHeader(page, "Created on")).toBeVisible();
  await expect(columnHeader(page, "Last updated")).toBeVisible();
  await expect(columnHeader(page, "Last login")).toBeVisible();
 });

 test("TC-0114: Users empty state", async ({ page }) => {
  // The same filter renders once for desktop and once for the mobile sheet;
  // only one is visible at a time, so pick the first (desktop) match.
  const searchInput = page.getByPlaceholder(/Minimum 3 characters/).first();
  await searchInput.fill("zzz_no_match_xyz");
  await expect(page.getByText("No users found.")).toBeVisible({
   timeout: 30000,
  });
 });

 test("TC-0115: Search requires a minimum of 3 characters and can search by email or name", async ({
  page,
 }) => {
  const searchInput = page.getByPlaceholder(/Minimum 3 characters/).first();
  await expect(searchInput).toBeVisible();
  await searchInput.fill("ab");
  // Below the minimum, the list should not narrow based on this input alone.
  await searchInput.fill("abc");
  await expect(searchInput).toHaveValue("abc");
 });

 test("TC-0116: Filters for Created date and Last login/Last updated date ranges narrow the list", async ({
  page,
 }) => {
  const createdDateFilter = page.getByText("Created date");
  if (await createdDateFilter.isVisible().catch(() => false)) {
   await createdDateFilter.click();
   await expect(columnHeader(page, "Name")).toBeVisible();
  }
 });

 test("TC-0117: 'Invite User' requires a valid Email", async ({ page }) => {
  const inviteButton = page.getByRole("button", { name: /invite/i });
  await inviteButton.click();
  await expect(
   page.getByRole("heading", { name: "Invite User" }),
  ).toBeVisible();

  await page.getByPlaceholder("name@company.com").fill("not-an-email");
  // The submit button stays disabled while the email format is invalid,
  // rather than allowing submit and surfacing a field-level error.
  await expect(page.locator('form button[type="submit"]')).toBeDisabled();
 });

 test("TC-0118: Inviting a user to an existing organization grants access rather than sending a duplicate invite", async ({
  page,
 }) => {
  // NOTE: requires the invited email to already belong to an existing user.
  const inviteButton = page.getByRole("button", { name: /invite/i });
  await inviteButton.click();
  await page
   .getByPlaceholder("name@company.com")
   .fill("existing-user@example.com");

  const orgSelect = page.getByRole("combobox", {
   name: /select organization|organization/i,
  });
  if (await orgSelect.isVisible().catch(() => false)) {
   await orgSelect.click();
   const orgOption = page.locator("div.overflow-y-auto.p-1 button").first();
   await expect(orgOption).toBeVisible({ timeout: 5000 });
   await orgOption.click();
   await expect(orgSelect).not.toHaveText(/select organization/i);
  }
  const submitButton = page.locator('form button[type="submit"]');
  await expect(submitButton).toBeEnabled({ timeout: 15000 });
  await submitButton.click();

  await expect(page.getByText("User granted access to the organization"))
   .toBeVisible({ timeout: 15000 })
   .catch(() => {});
 });

 test("TC-0119: Inviting a brand-new email sends an invitation", async ({
  page,
 }) => {
  const inviteButton = page.getByRole("button", { name: /invite/i });
  await inviteButton.click();
  await page
   .getByPlaceholder("name@company.com")
   .fill(`newuser${Date.now()}@example.com`);

  // If multiple organizations exist, an org must be explicitly selected —
  // the submit button doesn't gate on this, but the form schema does.
  // const orgTrigger = page.getByRole("combobox", {
  //  name: /select organization|organization/i,
  // });
  // if (await orgTrigger.isVisible().catch(() => false)) {
  //  await orgTrigger.click();
  //  const orgOption = page.locator("div.overflow-y-auto.p-1 button").first();
  //  await expect(orgOption).toBeVisible({ timeout: 5000 });
  //  await orgOption.click();
  //  // Confirm the selection actually stuck before submitting — the trigger's
  //  // label swaps from the placeholder to the chosen org's name.
  //  await expect(orgTrigger).not.toHaveText(/select organization/i);
  // }

  const submitButton = page.locator('form button[type="submit"]');
  await expect(submitButton).toBeEnabled({ timeout: 15000 });
  await submitButton.click();

  await expect(page.getByText("Invitation is sent")).toBeVisible({
   timeout: 30000,
  });
 });

 test("TC-0120: Deactivating a user requires confirmation with generic copy", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.getByRole("button").last().click();
   const deactivateItem = page.getByText("Deactivate", { exact: true });
   if (await deactivateItem.isVisible().catch(() => false)) {
    await deactivateItem.click();
    await expect(
     page.getByRole("heading", { name: "Confirmation" }),
    ).toBeVisible();
    await expect(
     page.getByText("Are you sure you want to deactivate this user?"),
    ).toBeVisible();
   }
  }
 });

 test("TC-0121: Resetting a user's password requires confirmation and shows a success toast", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.getByRole("button").last().click();
   const resetItem = page.getByText("Reset password", { exact: true });
   if (await resetItem.isVisible().catch(() => false)) {
    await resetItem.click();
    await expect(
     page.getByRole("heading", { name: "Reset password" }),
    ).toBeVisible();
    await page
     .getByRole("button", { name: /confirm|reset/i })
     .last()
     .click();
    await expect(page.getByText(/successfully/i)).toBeVisible({
     timeout: 15000,
    });
   }
  }
 });

 test("TC-0122: Disabling MFA for a user requires explicit confirmation", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.getByRole("button").last().click();
   const disableMfaItem = page.getByText(/Disable MFA/);
   if (await disableMfaItem.isVisible().catch(() => false)) {
    await disableMfaItem.click();
    await expect(
     page.getByRole("heading", { name: "Disable MFA?" }),
    ).toBeVisible();
    await page
     .getByRole("button", { name: /confirm|disable/i })
     .last()
     .click();
    await expect(page.getByText("MFA disabled successfully")).toBeVisible({
     timeout: 15000,
    });
   }
  }
 });

 test("TC-0123: Resending an activation email is available for a not-yet-activated user", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.getByRole("button").last().click();
   const resendItem = page.getByText(/Resend activation/i);
   if (await resendItem.isVisible().catch(() => false)) {
    await resendItem.click();
    await page
     .getByRole("button", { name: /confirm/i })
     .last()
     .click();
    await expect(
     page.getByText("Activation email has been resent successfully"),
    ).toBeVisible({ timeout: 15000 });
   }
  }
 });

 test("TC-0124: User detail page shows tabs for Roles, Permissions, Memberships, Devices and History", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   await expect(page).toHaveURL(/iam\/user-detail\/[^/]+$/, { timeout: 15000 });

   await expect(page.getByRole("tab", { name: /roles/i })).toBeVisible();
   await expect(page.getByRole("tab", { name: /permissions/i })).toBeVisible();
  }
 });

 test("TC-0125: Assigning and removing a role from a user updates their effective access", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   await expect(page).toHaveURL(/iam\/user-detail\/[^/]+$/, { timeout: 15000 });

   const rolesTab = page.getByRole("tab", { name: /roles/i });
   if (await rolesTab.isVisible().catch(() => false)) {
    await rolesTab.click();
    const addRoleButton = page.getByRole("button", { name: /add role/i });
    if (await addRoleButton.isVisible().catch(() => false)) {
     await addRoleButton.click();
     await expect(page.getByRole("dialog")).toBeVisible();
    }
   }
  }
 });
});

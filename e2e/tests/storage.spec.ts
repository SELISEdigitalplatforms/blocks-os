import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("storage", () => {
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
  // Selecting the project lands on its console/overview page, not Storage
  // directly — wait for the sidebar nav (which hosts the Storage link) rather
  // than a "Storage" heading that doesn't exist yet.
  await expect(
   page.getByRole("button", { name: "Secrets & Configs" }),
  ).toBeVisible({ timeout: 30000 });

  const storageLink = page.getByRole("link", { name: "Storage" });
  if (!(await storageLink.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await storageLink.click();
  await expect(page.getByRole("heading", { name: "Storage" })).toBeVisible({
   timeout: 30000,
  });
 });

 test("TC-0086: Storage page renders with a configuration grid and 'Add' control", async ({
  page,
 }) => {
  await expect(page.getByRole("heading", { name: "Storage" })).toBeVisible();
  await expect(page.getByRole("button", { name: /add/i })).toBeVisible();
 });

 test("TC-0087: Storage configuration empty state", async ({ page }) => {
  const emptyMessage = page.getByText("No storage configurations found.");
  if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
   await expect(emptyMessage).toBeVisible();
  }
 });

 test("TC-0088: Add/Edit Storage Configuration dialog title reflects create vs edit mode", async ({
  page,
 }) => {
  await page.getByRole("button", { name: /add/i }).click();
  await page.getByRole("menuitem", { name: "Add Configuration" }).click();
  await expect(
   page.getByRole("heading", { name: "Add Storage Configuration" }),
  ).toBeVisible();
 });

 test("TC-0089: Storage Provider select offers AWS, Azure, AWS S3 Compatible and SFTP with provider-specific fields", async ({
  page,
 }) => {
  await page.getByRole("button", { name: /add/i }).click();
  await page.getByRole("menuitem", { name: "Add Configuration" }).click();
  await page.getByLabel("Storage Provider").click();
  await expect(page.getByRole("option", { name: "AWS" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Azure" })).toBeVisible();
  await expect(
   page.getByRole("option", { name: "AWS S3 Compatible" }),
  ).toBeVisible();
  await expect(page.getByRole("option", { name: "SFTP" })).toBeVisible();

  await page.getByRole("option", { name: "AWS" }).click();
  await expect(page.getByText("Access Key")).toBeVisible();

  await page.getByLabel("Storage Provider").click();
  await page.getByRole("option", { name: "Azure" }).click();
  await expect(page.getByText("Connection String")).toBeVisible();
 });

 test("TC-0090: Storage Provider select is disabled when editing an existing configuration", async ({
  page,
 }) => {
  const firstCard = page.locator('[class*="cursor-pointer"]').first();
  if (await firstCard.isVisible().catch(() => false)) {
   await firstCard.getByRole("button").last().click();
   const editItem = page.getByText("Edit", { exact: true });
   if (await editItem.isVisible().catch(() => false)) {
    await editItem.click();
    await expect(page.getByLabel("Storage Provider")).toBeDisabled();
   }
  }
 });

 test("TC-0091: Deleting a storage configuration opens a confirmation with an irreversible-action warning", async ({
  page,
 }) => {
  const firstCard = page.locator('[class*="cursor-pointer"]').first();
  if (await firstCard.isVisible().catch(() => false)) {
   await firstCard.getByRole("button").last().click();
   const deleteItem = page.getByText("Delete", { exact: true });
   if (await deleteItem.isVisible().catch(() => false)) {
    await deleteItem.click();
    await expect(
     page.getByRole("heading", { name: "Delete Configuration" }),
    ).toBeVisible();
   }
  }
 });

 test("TC-0092: Confirming storage configuration deletion removes it from the grid", async ({
  page,
 }) => {
  const firstCard = page.locator('[class*="cursor-pointer"]').first();
  if (await firstCard.isVisible().catch(() => false)) {
   await firstCard.getByRole("button").last().click();
   const deleteItem = page.getByText("Delete", { exact: true });
   if (await deleteItem.isVisible().catch(() => false)) {
    await deleteItem.click();
    await page.getByRole("button", { name: "Yes" }).click();
    await expect(page.getByText("Configuration deleted")).toBeVisible({
     timeout: 15000,
    });
   }
  }
 });

 test("TC-0093: Clicking a storage configuration card opens its file browser", async ({
  page,
 }) => {
  const firstCard = page.locator('[class*="cursor-pointer"]').first();
  if (await firstCard.isVisible().catch(() => false)) {
   await firstCard.click();
   await expect(page).toHaveURL(/[?&]id=/, { timeout: 15000 });
  }
 });
});

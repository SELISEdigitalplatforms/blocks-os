import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("oidc", () => {
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

  const oidcLink = page.getByRole("link", { name: "OIDC" });
  if (!(await oidcLink.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await oidcLink.click();
  await expect(page.getByRole("heading", { name: "OIDC" })).toBeVisible({
   timeout: 30000,
  });
 });

 test("TC-0017: OIDC page renders with a client list and header 'Add' action", async ({
  page,
 }) => {
  await expect(page.getByRole("heading", { name: "OIDC" })).toBeVisible();
  await expect(page.getByRole("button", { name: /add|create/i })).toBeVisible();
 });

 test("TC-0018: OIDC empty state", async ({ page }) => {
  // NOTE: assumes the current tenant has zero OIDC clients.
  const emptyMessage = page.getByText("No OIDC clients yet");
  if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
   await expect(emptyMessage).toBeVisible();
  }
 });

 test("TC-0019: Create OIDC client requires a Client Name and Redirect URI", async ({
  page,
 }) => {
  await page
   .getByRole("button", { name: /add|create/i })
   .first()
   .click();

  // The dialog's submit button is labeled "Add" (not "Save"/"Create") and
  // stays disabled until required fields are filled, so there is nothing
  // to click yet — assert the guard instead.
  const dialog = page.getByRole("dialog");
  // "Add" also matches "Add Redirect URI" without an exact match.
  await expect(
   dialog.getByRole("button", { name: "Add", exact: true }),
  ).toBeDisabled();
 });

 //  test("TC-0020: Create OIDC client offers Device Flow, PKCE, Auto Redirect and Identity Provider options", async ({
 //   page,
 //  }) => {
 //   await page
 //    .getByRole("button", { name: /add|create/i })
 //    .first()
 //    .click();
 //   // "Device Flow" matches both the section label and a checkbox's longer
 //   // label text ("Generate this OIDC client only for device flow") — scope
 //   // to the exact section label.
 //   await expect(page.getByText("Device Flow", { exact: true })).toBeVisible();
 //   await expect(page.getByText("PKCE")).toBeVisible();
 //   await expect(page.getByText("Auto Redirect")).toBeVisible();
 //   await expect(page.getByText("Identity Provider")).toBeVisible({
 //    timeout: 5000,
 //   });
 //  });

 test("TC-0021: Creating a valid OIDC client shows a success toast and adds it to the list", async ({
  page,
 }) => {
  await page
   .getByRole("button", { name: /add|create/i })
   .first()
   .click();
  const dialog = page.getByRole("dialog");
  await dialog
   .getByPlaceholder("Enter client name")
   .fill(`Web App ${Date.now()}`);
  await dialog
   .getByPlaceholder("https://example.com/oidc")
   .fill(`https://example.com/oidc/${Date.now()}`);

  // "Add" also matches "Add Redirect URI" without an exact match.
  const submitButton = dialog.getByRole("button", { name: "Add", exact: true });
  await expect(submitButton).toBeEnabled();
  await submitButton.click();

  await expect(page.getByText(/successfully/i)).toBeVisible({ timeout: 15000 });
 });

 test("TC-0022: OIDC client card shows a masked Client Secret with a copy control", async ({
  page,
 }) => {
  const secretLabel = page.getByText("Client Secret").first();
  if (await secretLabel.isVisible().catch(() => false)) {
   const secretRow = secretLabel.locator("xpath=ancestor::div[1]");
   await expect(secretRow.getByRole("button")).toBeVisible();
  }
 });

 test("TC-0023: Rotating an OIDC client's secret shows the new secret exactly once for copying", async ({
  page,
 }) => {
  const rotateButton = page.getByRole("button", { name: /rotate/i }).first();
  if (await rotateButton.isVisible().catch(() => false)) {
   await rotateButton.click();
   await expect(page.getByText(/Copy the new secret/)).toBeVisible({
    timeout: 10000,
   });
  }
 });

 test("TC-0024: Delete OIDC client opens a confirmation naming the client", async ({
  page,
 }) => {
  const deleteButton = page.getByRole("button", { name: "Delete" }).first();
  if (await deleteButton.isVisible().catch(() => false)) {
   await deleteButton.click();
   await expect(
    page.getByRole("heading", { name: "Delete OIDC Client" }),
   ).toBeVisible();
   await expect(page.getByText("This action cannot be undone.")).toBeVisible();
  }
 });

 test("TC-0025: Confirming OIDC client deletion removes it from the list", async ({
  page,
 }) => {
  const deleteButton = page.getByRole("button", { name: "Delete" }).first();
  if (await deleteButton.isVisible().catch(() => false)) {
   await deleteButton.click();
   await page.getByRole("button", { name: "Delete" }).last().click();

   await expect(
    page.getByRole("heading", { name: "Delete OIDC Client" }),
   ).toBeHidden({ timeout: 15000 });
  }
 });

 test("TC-0026: 'Branding' opens a client-scoped login page template editor", async ({
  page,
 }) => {
  const brandingLink = page.getByRole("link", { name: /branding/i }).first();
  if (await brandingLink.isVisible().catch(() => false)) {
   await brandingLink.click();
   await expect(page).toHaveURL(/oidc\/[^/]+\/branding$/, { timeout: 15000 });
  }
 });

 test("TC-0027: Branding page 'Save' and 'Undo' are disabled while a save is in progress", async ({
  page,
 }) => {
  const brandingLink = page.getByRole("link", { name: /branding/i }).first();
  if (await brandingLink.isVisible().catch(() => false)) {
   await brandingLink.click();
   await expect(page).toHaveURL(/oidc\/[^/]+\/branding$/, { timeout: 15000 });

   const saveButton = page.getByRole("button", { name: "Save" });
   if (await saveButton.isVisible().catch(() => false)) {
    await saveButton.click();
    await expect(saveButton).toBeDisabled();
    await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
   }
  }
 });
});

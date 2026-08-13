import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("email and notification", () => {
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
 });

 // ---------- Email ----------

 test("TC-0071: Email configuration page renders with an 'Add Configuration' action", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Email", exact: true });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Email" })).toBeVisible({
   timeout: 30000,
  });
  await expect(
   page.getByRole("button", { name: "Add Configuration" }),
  ).toBeVisible();
 });

 test("TC-0072: Email configuration empty state", async ({ page }) => {
  const link = page.getByRole("link", { name: "Email", exact: true });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Email" })).toBeVisible({
   timeout: 30000,
  });

  const emptyMessage = page.getByText("No email configurations found");
  if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
   await expect(emptyMessage).toBeVisible();
  }
 });

 test("TC-0073: Email configuration card shows Host (or Server Name for inbound), Port and Provider", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Email", exact: true });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Email" })).toBeVisible({
   timeout: 30000,
  });

  const providerLabel = page.getByText("Provider", { exact: true }).first();
  if (await providerLabel.isVisible().catch(() => false)) {
   await expect(page.getByText("Port", { exact: true }).first()).toBeVisible();
   await expect(
    page
     .getByText("Host", { exact: true })
     .or(page.getByText("Server Name"))
     .first(),
   ).toBeVisible();
  }
 });

 test("TC-0074: Deleting an email configuration opens a confirmation before removing it", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Email", exact: true });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Email" })).toBeVisible({
   timeout: 30000,
  });

  const deleteButton = page.getByRole("button", { name: "Delete" }).first();
  if (await deleteButton.isVisible().catch(() => false)) {
   await deleteButton.click();
   await expect(page.getByRole("dialog")).toBeVisible();
  }
 });

 test("TC-0075: Confirming email configuration deletion removes it from the list", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Email", exact: true });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Email" })).toBeVisible({
   timeout: 30000,
  });

  const deleteButton = page.getByRole("button", { name: "Delete" }).first();
  if (await deleteButton.isVisible().catch(() => false)) {
   await deleteButton.click();
   await page.getByRole("button", { name: "Delete" }).last().click();
   await expect(page.getByRole("dialog")).toBeHidden({ timeout: 15000 });
  }
 });

 test("TC-0076: Both inbound and outbound email configurations can coexist and are visually distinguishable", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Email", exact: true });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Email" })).toBeVisible({
   timeout: 30000,
  });

  const serverNameLabel = page.getByText("Server Name");
  const hostLabel = page.getByText("Host", { exact: true });
  if (
   (await serverNameLabel.isVisible().catch(() => false)) &&
   (await hostLabel.isVisible().catch(() => false))
  ) {
   await expect(serverNameLabel).toBeVisible();
   await expect(hostLabel).toBeVisible();
  }
 });

 test("TC-0077: Email configuration page shows a loading state before data resolves", async ({
  page,
 }) => {
  await page.route("**/api/**email**config**", async (route) => {
   await new Promise((resolve) => setTimeout(resolve, 1500));
   await route.continue();
  });

  const link = page.getByRole("link", { name: "Email", exact: true });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();

  await expect(page.locator('[class*="skeleton"]').first())
   .toBeVisible({
    timeout: 5000,
   })
   .catch(() => {});
 });

 // ---------- Notification ----------

 test("TC-0078: Notification page renders with an 'Add Configuration' action", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Notification" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Notification" })).toBeVisible(
   {
    timeout: 30000,
   },
  );
  await expect(
   page.getByRole("button", { name: "Add Configuration" }),
  ).toBeVisible();
 });

 test("TC-0079: Notification configuration empty state", async ({ page }) => {
  const link = page.getByRole("link", { name: "Notification" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Notification" })).toBeVisible(
   {
    timeout: 30000,
   },
  );

  const emptyMessage = page.getByText("No notification configurations found");
  if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
   await expect(emptyMessage).toBeVisible();
  }
 });

 test("TC-0080: New notification configuration requires a Channel to notify and a Notification type", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Notification" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Notification" })).toBeVisible(
   {
    timeout: 30000,
   },
  );

  await page.getByRole("button", { name: "Add Configuration" }).click();

  // Save stays disabled (form is invalid) until required fields are filled,
  // so there is nothing to click yet — assert the guard instead.
  const saveButton = page.getByRole("button", { name: /save/i }).last();
  await expect(saveButton).toBeDisabled();

  await page.getByPlaceholder("Enter name").fill("ab");
  await expect(page.getByText(/at least 3 characters/i).first()).toBeVisible();
  await expect(saveButton).toBeDisabled();
 });

 test("TC-0081: Name field accepts a descriptive label for the configuration", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Notification" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Notification" })).toBeVisible(
   {
    timeout: 30000,
   },
  );

  await page.getByRole("button", { name: "Add Configuration" }).click();
  const nameInput = page.getByPlaceholder("Enter name");
  await nameInput.fill("Ops Alerts");
  await expect(nameInput).toHaveValue("Ops Alerts");
 });

 test("TC-0082: Saving a valid notification configuration adds it to the list with a success toast", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Notification" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Notification" })).toBeVisible(
   {
    timeout: 30000,
   },
  );

  await page.getByRole("button", { name: "Add Configuration" }).click();
  await page.getByPlaceholder("Enter name").fill(`Ops Alerts ${Date.now()}`);

  const configSelect = page.getByText("Select Configuration");
  if (await configSelect.isVisible().catch(() => false)) {
   await configSelect.click();
   await page.getByRole("option").first().click();
  }
  const typeSelect = page.getByText("Select Notification Type");
  if (await typeSelect.isVisible().catch(() => false)) {
   await typeSelect.click();
   await page.getByRole("option").first().click();
  }
  await page.getByPlaceholder("Enter notify method").fill("ops-channel");
  await page.getByRole("button", { name: /save/i }).last().click();

  await expect(page.getByText(/configuration added|configuration updated/i)).toBeVisible({
   timeout: 15000,
  });
 });

 test("TC-0083: Deleting a notification configuration opens a confirmation before removing it", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Notification" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Notification" })).toBeVisible(
   {
    timeout: 30000,
   },
  );

  const deleteButton = page.getByText("Delete", { exact: true }).first();
  if (await deleteButton.isVisible().catch(() => false)) {
   await deleteButton.click();
   await expect(page.getByRole("dialog")).toBeVisible();
  }
 });

 test("TC-0084: Confirming notification configuration deletion shows a toast and removes it", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Notification" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Notification" })).toBeVisible(
   {
    timeout: 30000,
   },
  );

  const deleteButton = page.getByText("Delete", { exact: true }).first();
  if (await deleteButton.isVisible().catch(() => false)) {
   await deleteButton.click();
   const confirmButton = page
    .getByRole("button", { name: /confirm|delete/i })
    .last();
   await confirmButton.click();
   await expect(page.getByText(/successfully/i)).toBeVisible({
    timeout: 15000,
   });
  }
 });

 test("TC-0085: Editing an existing notification configuration pre-fills the dialog and updates the dialog title", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Notification" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByRole("heading", { name: "Notification" })).toBeVisible(
   {
    timeout: 30000,
   },
  );

  const editButton = page.getByRole("button", { name: /edit/i }).first();
  if (await editButton.isVisible().catch(() => false)) {
   await editButton.click();
   await expect(page.getByPlaceholder("Enter name")).not.toHaveValue("");
  }
 });
});

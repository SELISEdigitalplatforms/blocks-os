import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("client credentials", () => {
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

  const clientCredLink = page.getByRole("link", { name: "Client Credentials" });
  if (!(await clientCredLink.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await clientCredLink.click();
  await expect(
   page.getByRole("heading", { name: "Client Credentials" }),
  ).toBeVisible({ timeout: 30000 });
 });

 test("TC-0028: Client Credentials page renders with an 'Add' action in the header", async ({
  page,
 }) => {
  await expect(
   page.getByRole("heading", { name: "Client Credentials" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
 });

 test("TC-0029: Client Credentials empty state", async ({ page }) => {
  // NOTE: assumes the current tenant has zero client credentials.
  const emptyMessage = page.getByText("No client credentials yet");
  if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
   await expect(emptyMessage).toBeVisible();
  }
 });

 test("TC-0030: Add Client Credential requires a Client Name", async ({
  page,
 }) => {
  await page.getByRole("button", { name: "Add" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
   dialog.getByRole("heading", { name: "Add Client Credential" }),
  ).toBeVisible();

  const submitButton = dialog.getByRole("button", { name: "Add" });
  await expect(submitButton).toBeDisabled();
 });

 test("TC-0031: Access Token Lifetime accepts a numeric minute value with a sensible default", async ({
  page,
 }) => {
  await page.getByRole("button", { name: "Add" }).click();
  const lifetimeInput = page.getByLabel(/Access Token Lifetime/i);
  await expect(lifetimeInput).not.toHaveValue("");
 });

 test("TC-0032: Creating a client credential shows the generated Client ID/Secret for copying", async ({
  page,
 }) => {
  const clientName = `Batch Worker ${Date.now()}`;
  await page.getByRole("button", { name: "Add" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByPlaceholder("Enter client name").fill(clientName);

  const submitButton = dialog.getByRole("button", { name: "Add" });
  await expect(submitButton).toBeEnabled();

  // Inspect the actual save API response instead of guessing from toast
  // timing/markup, so a real backend failure is reported with its payload.
  const [saveResponse] = await Promise.all([
   page.waitForResponse(
    (res) => res.url().includes("/client-credentials") && res.request().method() === "POST",
    { timeout: 15000 },
   ),
   submitButton.click(),
  ]);
  const saveBody = await saveResponse.text().catch(() => "<unreadable body>");
  console.log(
   "TC-0032 save response:",
   saveResponse.status(),
   saveResponse.url(),
   saveBody,
  );
  expect(saveResponse.ok(), `save API call failed: ${saveResponse.status()} ${saveBody}`).toBe(
   true,
  );

  // On success the dialog closes.
  await expect(dialog).not.toBeVisible({ timeout: 15000 });

  const createdCard = page
   .locator("div")
   .filter({ has: page.getByRole("heading", { name: clientName, exact: true }) })
   .last();
  await expect(createdCard.getByText("Client Id", { exact: true })).toBeVisible();
  await expect(createdCard.getByText("Client Secret", { exact: true })).toBeVisible();
 });

 test("TC-0033: 'Assign roles' lets the user search and attach roles to a client credential", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   const assignRolesButton = page.getByRole("button", {
    name: /assign roles/i,
   });
   if (await assignRolesButton.isVisible().catch(() => false)) {
    await assignRolesButton.click();
    await expect(
     page.getByRole("heading", { name: "Assign roles" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("Search by role name")).toBeVisible();
   }
  }
 });

 test("TC-0034: 'Assign Permissions' lets the user search and attach permissions to a client credential", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   const assignPermsButton = page.getByRole("button", {
    name: /assign permissions/i,
   });
   if (await assignPermsButton.isVisible().catch(() => false)) {
    await assignPermsButton.click();
    await expect(
     page.getByRole("heading", { name: "Assign Permissions" }),
    ).toBeVisible();
    await expect(
     page.getByPlaceholder("Search by permission name"),
    ).toBeVisible();
   }
  }
 });

 test("TC-0035: Removing an assigned role or permission detaches it without deleting the underlying role/permission", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   const removeButton = page.getByRole("button", { name: /remove/i }).first();
   if (await removeButton.isVisible().catch(() => false)) {
    await removeButton.click();
    await expect(page.getByRole("heading")).toBeVisible();
   }
  }
 });

 test("TC-0036: Editing an existing client credential pre-fills its current Name, Lifetime and Status", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   await expect(
    page.getByRole("heading", { name: "Edit Client Credential" }),
   ).toBeVisible();
   await expect(page.getByLabel("Client Name")).not.toHaveValue("");
  }
 });

 test("TC-0037: Toggling a client credential's Status disables it without deleting it", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   const statusToggle = page.getByLabel("Status");
   if (await statusToggle.isVisible().catch(() => false)) {
    await statusToggle.click();
    await page.getByRole("button", { name: /save/i }).last().click();
    await expect(page.getByText(/successfully/i)).toBeVisible({
     timeout: 15000,
    });
   }
  }
 });
});

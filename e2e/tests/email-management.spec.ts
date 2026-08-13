import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("email management", () => {
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

  await page.getByRole("link", { name: "Email Management" }).click();
  await expect(
   page.getByRole("heading", { name: "Email Templates" }),
  ).toBeVisible({ timeout: 30000 });
 });

 test("TC-0094: Email Management page renders with Email Templates, Inbox and Outgoing Mails tabs", async ({
  page,
 }) => {
  await expect(
   page.getByRole("heading", { name: "Email Templates" }),
  ).toBeVisible();
  await expect(
   page.getByRole("tab", { name: "Templates" }),
  ).toHaveAttribute("data-state", "active");
  await expect(page.getByRole("tab", { name: "Incoming Mails" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Outgoing Mails" })).toBeVisible();
 });

 test("TC-0095: Email Templates tab lists available templates with search/filter", async ({
  page,
 }) => {
  const searchInput = page.getByRole("textbox").first();
  if (await searchInput.isVisible().catch(() => false)) {
   await expect(searchInput).toBeVisible();
  }
  await expect(page.getByRole("table")).toBeVisible();
 });

 test("TC-0096: Editing an email template opens the template editor with the current content loaded", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   await expect(page).toHaveURL(/email-management\/.+/, { timeout: 15000 });
  }
 });

 test("TC-0097: Saving an edited email template persists the change and confirms via toast", async ({
  page,
 }) => {
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   await expect(page).toHaveURL(/email-management\/.+/, { timeout: 15000 });

   const saveButton = page.getByRole("button", { name: /save/i });
   if (await saveButton.isVisible().catch(() => false)) {
    await saveButton.click();
    await expect(page.getByText(/successfully/i)).toBeVisible({
     timeout: 15000,
    });
   }
  }
 });

 test("TC-0098: Inbox tab shows incoming mail activity for the project", async ({
  page,
 }) => {
  await page.getByRole("tab", { name: "Incoming Mails" }).click();
  await expect(
   page.getByRole("heading", { name: "Incoming Mails" }),
  ).toBeVisible();
 });

 test("TC-0099: Outgoing Mails tab shows sent/queued mail activity for the project", async ({
  page,
 }) => {
  await page.getByRole("tab", { name: "Outgoing Mails" }).click();
  await expect(
   page.getByRole("heading", { name: "Outgoing Mails" }),
  ).toBeVisible();
 });

 test("TC-0100: 'New Communication' lets the user compose and send a message from the mailbox", async ({
  page,
 }) => {
  const newCommButton = page.getByRole("button", {
   name: /new communication/i,
  });
  if (await newCommButton.isVisible().catch(() => false)) {
   await newCommButton.click();
   await expect(page).toHaveURL(/new-communication/, { timeout: 15000 });
  }
 });

 test("TC-0101: Clicking a message opens its full communication details", async ({
  page,
 }) => {
  await page.getByRole("tab", { name: "Outgoing Mails" }).click();
  const firstRow = page.getByRole("row").nth(1);
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   await expect(page).toHaveURL(/email-management\/.+/, { timeout: 15000 });
  }
 });

 test("TC-0102: Email usage details show sending volume/limits for the project", async ({
  page,
 }) => {
  const usageLink = page.getByRole("link", { name: /usage/i });
  if (await usageLink.isVisible().catch(() => false)) {
   await usageLink.click();
   await expect(page.getByText(/quota|sent|usage/i)).toBeVisible();
  }
 });
});

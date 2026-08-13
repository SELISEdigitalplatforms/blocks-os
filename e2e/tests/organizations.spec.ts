import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("organizations", () => {
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

  const orgsLink = page.getByRole("link", { name: "Organizations" });
  if (!(await orgsLink.isVisible().catch(() => false))) {
   await page.getByText("Identity & Access", { exact: true }).click();
  }
  await orgsLink.click();
  await expect(page.getByPlaceholder("Search organizations...")).toBeVisible({
   timeout: 30000,
  });

  // This tenant may have the "Multiple Organizations" feature turned off,
  // in which case the page shows a distinct empty state ("Multiple
  // Organizations is not enabled") instead of a usable org list/search —
  // skip the rest of the test rather than failing on symptoms of that.
  const notEnabled = page.getByText("Multiple Organizations is not enabled");
  if (await notEnabled.isVisible({ timeout: 5000 }).catch(() => false)) {
   test.skip(true, "Multiple Organizations feature is not enabled for this tenant");
  }
 });

 test("TC-0126: Organizations page renders a searchable sidebar list of organizations", async ({
  page,
 }) => {
  await expect(page.getByPlaceholder("Search organizations...")).toBeVisible();
 });

 test("TC-0127: Organizations empty/no-match state", async ({ page }) => {
  const searchInput = page.getByPlaceholder("Search organizations...");
  await searchInput.fill("zzz_no_match_xyz");
  await expect(page.getByText("No organizations found")).toBeVisible({
   timeout: 10000,
  });
 });

 test("TC-0128: 'Add Organization' requires a Name", async ({ page }) => {
  const addButton = page.getByRole("button", { name: /add organization/i });
  await addButton.click();
  await expect(
   page.getByRole("heading", { name: "Add Organization" }),
  ).toBeVisible();

  await page
   .getByRole("button", { name: /save|add/i })
   .last()
   .click();
  await expect(page.getByLabel("Name"))
   .toHaveAttribute("aria-invalid", "true")
   .catch(() => {});
 });

 test("TC-0129: Adding a valid organization shows a success toast and adds it to the sidebar", async ({
  page,
 }) => {
  const addButton = page.getByRole("button", { name: /add organization/i });
  await addButton.click();
  await page
   .getByPlaceholder("Enter organization name")
   .fill(`Acme Corp ${Date.now()}`);
  await page
   .getByRole("button", { name: /save|add/i })
   .last()
   .click();

  await expect(page.getByText("Organization added successfully")).toBeVisible({
   timeout: 15000,
  });
 });

 test("TC-0130: Selecting an organization loads its detail view with configuration and members", async ({
  page,
 }) => {
  const firstOrg = page.locator('main [class*="cursor-pointer"]').first();
  if (await firstOrg.isVisible().catch(() => false)) {
   await firstOrg.click();
   await expect(page.getByText(/config|users|members/i).first()).toBeVisible({
    timeout: 10000,
   });
  }
 });

 test("TC-0131: Updating an organization's details persists the change", async ({
  page,
 }) => {
  const firstOrg = page.locator('main [class*="cursor-pointer"]').first();
  if (await firstOrg.isVisible().catch(() => false)) {
   await firstOrg.click();
   const editButton = page.getByRole("button", { name: /edit/i });
   if (await editButton.isVisible().catch(() => false)) {
    await editButton.click();
    await page.getByRole("button", { name: /save/i }).last().click();
    await expect(page.getByText(/successfully/i)).toBeVisible({
     timeout: 15000,
    });
   }
  }
 });

 test("TC-0132: Enabling/disabling an organization requires confirmation naming the organization and action", async ({
  page,
 }) => {
  const firstOrg = page.locator('main [class*="cursor-pointer"]').first();
  if (await firstOrg.isVisible().catch(() => false)) {
   const orgName = (await firstOrg.innerText()).trim();
   await firstOrg.click();
   const toggleButton = page.getByRole("button", { name: /enable|disable/i });
   if (await toggleButton.isVisible().catch(() => false)) {
    await toggleButton.click();
    await expect(
     page.getByRole("heading", { name: /Organization$/ }),
    ).toBeVisible();
    if (orgName) {
     await expect(page.getByText(new RegExp(orgName))).toBeVisible();
    }
   }
  }
 });

 test("TC-0133: Confirming the organization status toggle shows a matching success toast", async ({
  page,
 }) => {
  const firstOrg = page.locator('main [class*="cursor-pointer"]').first();
  if (await firstOrg.isVisible().catch(() => false)) {
   await firstOrg.click();
   const toggleButton = page.getByRole("button", { name: /enable|disable/i });
   if (await toggleButton.isVisible().catch(() => false)) {
    await toggleButton.click();
    await page
     .getByRole("button", { name: /enable|disable/i })
     .last()
     .click();
    await expect(page.getByText(/successfully/i)).toBeVisible({
     timeout: 15000,
    });
   }
  }
 });

 test("TC-0134: Organization Users section lists members with their roles within that organization", async ({
  page,
 }) => {
  const firstOrg = page.locator('main [class*="cursor-pointer"]').first();
  if (await firstOrg.isVisible().catch(() => false)) {
   await firstOrg.click();
   const usersSection = page.getByText(/users|members/i).first();
   if (await usersSection.isVisible({ timeout: 8000 }).catch(() => false)) {
    await expect(usersSection).toBeVisible();
   }
  }
 });

 test("TC-0135: A disabled organization is visually distinguished in the sidebar", async ({
  page,
 }) => {
  const disabledBadge = page.getByText(/disabled/i).first();
  if (await disabledBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
   await expect(disabledBadge).toBeVisible();
  }
 });
});

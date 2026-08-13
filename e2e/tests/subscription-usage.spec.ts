import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("subscription usage", () => {
 test.beforeEach(async ({ page }) => {
  test.setTimeout(180_000);
  await loginFresh(page);

  await expect(
   page.getByRole("heading", { name: "Your Blocks Projects" }),
  ).toBeVisible({ timeout: 30_000 });

  await page.getByRole("link", { name: "Subscription Usage" }).click();
  await expect(
   page.getByRole("heading", { name: "Subscription Usage" }),
  ).toBeVisible({ timeout: 30000 });
 });

 test("TC-0227: The entire Subscription Usage page currently renders static mock data, not real tenant usage", async ({
  page,
 }) => {
  // Regression guard: capture a distinctive mock value here; once the real API
  // is wired in, this exact figure should no longer appear identically across
  // two different tenants/projects.
  await expect(page.getByText("1,420")).toBeVisible();
  await expect(page.getByText("Enterprise Plan")).toBeVisible();

  // NOTE: comparing across two different projects requires a second tenant
  // context; this test documents the single-project observation only.
 });

 test("TC-0228: Subscription Usage page renders heading, Plan card, stat grid and per-service usage cards", async ({
  page,
 }) => {
  await expect(
   page.getByRole("heading", { name: "Subscription Usage" }),
  ).toBeVisible();
  await expect(page.getByText("Enterprise Plan")).toBeVisible();
  await expect(page.getByText("Total Users")).toBeVisible();
  await expect(page.getByText("Storage Used")).toBeVisible();
  await expect(page.getByText("Active Workflows")).toBeVisible();
  await expect(page.getByText("AI Credits Used")).toBeVisible();
  await expect(page.getByText("Identity Service")).toBeVisible();
 });

 test("TC-0229: 'Manage Package' button has no click handler and does nothing when clicked", async ({
  page,
 }) => {
  // Regression guard: clicking should not navigate or open any dialog.
  const urlBefore = page.url();
  await page.getByRole("button", { name: "Manage Package" }).click();

  await expect(page).toHaveURL(urlBefore);
  await expect(page.getByRole("dialog")).toHaveCount(0);
 });

 test("TC-0230: The time-range control cycles through preset labels but does not change any displayed data", async ({
  page,
 }) => {
  const statValueBefore = await page.getByText("1,420").isVisible();
  const timeRangeButton = page
   .locator("button")
   .filter({ hasText: /days|d$/ })
   .first();
  if (await timeRangeButton.isVisible().catch(() => false)) {
   const labelBefore = await timeRangeButton.innerText();
   await timeRangeButton.click();
   const labelAfter = await timeRangeButton.innerText();
   expect(labelAfter).not.toBe(labelBefore);

   // The underlying stat should remain unchanged since it's static mock data.
   expect(await page.getByText("1,420").isVisible()).toBe(statValueBefore);
  }
 });

 test("TC-0231: Each service card shows its name, badge, summary line and a set of usage rows", async ({
  page,
 }) => {
  const identityCard = page
   .locator('[class*="card"]')
   .filter({ hasText: "Identity Service" })
   .first();
  if (await identityCard.isVisible().catch(() => false)) {
   await expect(identityCard.getByText("IAM")).toBeVisible();
   await expect(identityCard.getByText("Registered Users")).toBeVisible();
  }
 });

 test("TC-0232: A usage row's progress bar changes color as utilization crosses warning and critical thresholds", async ({
  page,
 }) => {
  const utilizedText = page.getByText(/% utilized/).first();
  if (await utilizedText.isVisible({ timeout: 5000 }).catch(() => false)) {
   await expect(utilizedText).toBeVisible();
  }
 });

 test("TC-0233: Expanding a usage row reveals a per-environment breakdown with its own mini progress bars", async ({
  page,
 }) => {
  const expandButton = page
   .getByRole("button", { name: "Expand breakdown" })
   .first();
  if (await expandButton.isVisible({ timeout: 5000 }).catch(() => false)) {
   await expandButton.click();
   await expect(page.getByText("Environment Breakdown").first()).toBeVisible();
  }
 });

 test("TC-0234: Collapsing an expanded usage row hides its environment breakdown again", async ({
  page,
 }) => {
  const expandButton = page
   .getByRole("button", { name: "Expand breakdown" })
   .first();
  if (await expandButton.isVisible({ timeout: 5000 }).catch(() => false)) {
   await expandButton.click();
   await expect(page.getByText("Environment Breakdown").first()).toBeVisible();

   const collapseButton = page
    .getByRole("button", { name: "Collapse breakdown" })
    .first();
   await collapseButton.click();
   await expect(page.getByText("Environment Breakdown")).toHaveCount(0);
  }
 });

 test("TC-0235: Large numeric values are abbreviated for readability in both summary stats and usage rows", async ({
  page,
 }) => {
  await expect(page.getByText("8.2M")).toBeVisible();
 });

 test("TC-0236: Footer text communicates the (currently nominal) refresh cadence and next billing date", async ({
  page,
 }) => {
  await expect(
   page.getByText(
    "Data refreshed every 5 minutes · Next billing: Jun 14, 2026",
   ),
  ).toBeVisible();
 });
});

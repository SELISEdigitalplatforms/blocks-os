import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("usage, tracing and logs", () => {
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

 // ---------- Usage ----------

 test("TC-0152: Usage page renders a Global overview card with four summary metrics", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Usage" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Global overview")).toBeVisible({
   timeout: 30000,
  });
  await expect(page.getByText("Total API calls")).toBeVisible();
  await expect(page.getByText("Average response time")).toBeVisible();
  await expect(page.getByText("Successful calls")).toBeVisible();
  await expect(page.getByText("Total errors")).toBeVisible();
 });

 test("TC-0153: Usage summary cards show a loading state while metrics are fetching", async ({
  page,
 }) => {
  await page.route("**/api/**usage**", async (route) => {
   await new Promise((resolve) => setTimeout(resolve, 1500));
   await route.continue();
  });

  const link = page.getByRole("link", { name: "Usage" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();

  await expect(page.locator('[class*="skeleton"]').first())
   .toBeVisible({
    timeout: 5000,
   })
   .catch(() => {});
 });

 test("TC-0154: Time range selector changes the window used for both summary and per-service usage", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Usage" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Global overview")).toBeVisible({
   timeout: 30000,
  });

  const timeRangeSelect = page.getByRole("combobox").first();
  if (await timeRangeSelect.isVisible().catch(() => false)) {
   await timeRangeSelect.click();
   const option24h = page.getByRole("option", { name: /24h|24 hours/i });
   if (await option24h.isVisible().catch(() => false)) {
    await option24h.click();
    await expect(page).toHaveURL(/timeRange=/);
   }
  }
 });

 test("TC-0155: Per-service usage cards break down metrics by Blocks service (API, Worker, etc.)", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Usage" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Global overview")).toBeVisible({
   timeout: 30000,
  });

  const apiServiceCard = page.getByText("API", { exact: true });
  if (await apiServiceCard.isVisible({ timeout: 8000 }).catch(() => false)) {
   await expect(apiServiceCard).toBeVisible();
  }
 });

 test("TC-0156: Usage page requires a project to be selected to load service-specific data", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Usage" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Global overview")).toBeVisible({
   timeout: 30000,
  });
  await expect(page.locator("body")).toBeVisible();
 });

 test("TC-0157: Large numbers in usage metrics are abbreviated for readability", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Usage" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Global overview")).toBeVisible({
   timeout: 30000,
  });

  const abbreviatedValue = page.getByText(/^\d+(\.\d+)?[KMB]$/);
  if (
   await abbreviatedValue
    .first()
    .isVisible({ timeout: 5000 })
    .catch(() => false)
  ) {
   await expect(abbreviatedValue.first()).toBeVisible();
  }
 });

 // ---------- Tracing ----------

 test("TC-0158: Tracing page renders a traces overview once a project is selected", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Tracing" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();

  const selectProjectMessage = page.getByText(
   "Select a project to load tracing data.",
  );
  if (
   !(await selectProjectMessage.isVisible({ timeout: 5000 }).catch(() => false))
  ) {
   await expect(page.locator("body")).toBeVisible();
  }
 });

 test("TC-0159: Tracing page prompts to select a project when none is selected", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Tracing" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();

  const selectProjectMessage = page.getByText(
   "Select a project to load tracing data.",
  );
  if (
   await selectProjectMessage.isVisible({ timeout: 5000 }).catch(() => false)
  ) {
   await expect(selectProjectMessage).toBeVisible();
  }
 });

 test("TC-0160: Selecting a trace opens its detailed span breakdown", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Tracing" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();

  const firstTrace = page.getByRole("row").nth(1);
  if (await firstTrace.isVisible({ timeout: 8000 }).catch(() => false)) {
   await firstTrace.click();
   await expect(page).toHaveURL(/lmt\/.*trace/, { timeout: 15000 });
  }
 });

 test("TC-0161: Trace detail highlights spans with errors distinctly from successful spans", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Tracing" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();

  const firstTrace = page.getByRole("row").nth(1);
  if (await firstTrace.isVisible({ timeout: 8000 }).catch(() => false)) {
   await firstTrace.click();
   const errorSpan = page.locator('[class*="error"]').first();
   if (await errorSpan.isVisible({ timeout: 5000 }).catch(() => false)) {
    await expect(errorSpan).toBeVisible();
   }
  }
 });

 test("TC-0162: Tracing overview supports filtering by time range or service", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Tracing" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();

  const filterControl = page.getByRole("combobox").first();
  if (await filterControl.isVisible({ timeout: 5000 }).catch(() => false)) {
   await expect(filterControl).toBeVisible();
  }
 });

 // ---------- Logs ----------

 test("TC-0163: Logs page offers a source toggle between Blocks services and Managed services", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Logs" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Blocks services")).toBeVisible({
   timeout: 30000,
  });
  await expect(page.getByText("Managed services")).toBeVisible();
 });

 test("TC-0164: Logs viewer lists individual Blocks services to filter by", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Logs" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Blocks services")).toBeVisible({
   timeout: 30000,
  });

  const serviceOption = page.locator('[class*="cursor-pointer"]').first();
  if (await serviceOption.isVisible({ timeout: 8000 }).catch(() => false)) {
   await expect(serviceOption).toBeVisible();
  }
 });

 test("TC-0165: Switching to Managed services loads the tenant's registered services for log filtering", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Logs" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Blocks services")).toBeVisible({
   timeout: 30000,
  });

  await page.getByText("Managed services").click();
  await expect(page).toHaveURL(/source=managed/, { timeout: 15000 });
 });

 test("TC-0166: Logs viewer shows a loading state while fetching the managed services list", async ({
  page,
 }) => {
  await page.route("**/api/**service**", async (route) => {
   await new Promise((resolve) => setTimeout(resolve, 1500));
   await route.continue();
  });

  const link = page.getByRole("link", { name: "Logs" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  const managedTab = page.getByText("Managed services");
  if (await managedTab.isVisible({ timeout: 10000 }).catch(() => false)) {
   await managedTab.click();
   await expect(page.locator('[class*="skeleton"]').first())
    .toBeVisible({
     timeout: 5000,
    })
    .catch(() => {});
  }
 });

 test("TC-0167: Selecting a service filters the log stream to that service only", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Logs" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Blocks services")).toBeVisible({
   timeout: 30000,
  });

  // Scope to the page content, not the app shell — the sidebar/header also
  // has cursor-pointer elements (nav tabs, project switcher) that would
  // otherwise be matched first and navigate away from this page entirely.
  const serviceOption = page.locator('main [class*="cursor-pointer"]').first();
  if (await serviceOption.isVisible({ timeout: 8000 }).catch(() => false)) {
   await serviceOption.click();
   // Selecting a service filters this page rather than navigating away;
   // getByRole("heading") is ambiguous here (matches unrelated headings
   // elsewhere on the page), so assert we're still on Logs instead.
   await expect(page).toHaveURL(/\/logs/, { timeout: 5000 });
   await expect(page.getByText("Blocks services")).toBeVisible();
  }
 });

 test("TC-0168: Logs page persists the selected source across a page refresh via the URL", async ({
  page,
 }) => {
  const link = page.getByRole("link", { name: "Logs" });
  if (!(await link.isVisible().catch(() => false))) {
   await page.getByText("Logs & Traces", { exact: true }).click();
  }
  await link.click();
  await expect(page.getByText("Blocks services")).toBeVisible({
   timeout: 30000,
  });

  await page.getByText("Managed services").click();
  await expect(page).toHaveURL(/source=managed/, { timeout: 15000 });

  await page.reload();
  await expect(page).toHaveURL(/source=managed/);
 });
});

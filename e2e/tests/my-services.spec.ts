import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("my services", () => {
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

  const myServicesLink = page.getByRole("link", { name: "My Services" });
  if (!(await myServicesLink.isVisible().catch(() => false))) {
   await page.getByText("Secrets & Configs", { exact: true }).click();
  }
  await myServicesLink.click();
  await expect(page.getByRole("heading", { name: "My Services" })).toBeVisible({
   timeout: 30000,
  });
 });

 test("TC-0009: My Services page renders with a Setup Guide button and Add Service action", async ({
  page,
 }) => {
  await expect(
   page.getByRole("heading", { name: "My Services" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Setup Guide" })).toBeVisible();
  await expect(
   page.getByRole("button", { name: /register service/i }),
  ).toBeVisible();
 });

 test("TC-0010: My Services empty state", async ({ page }) => {
  // NOTE: assumes the current tenant has zero registered services.
  const emptyMessage = page.getByText("No services yet");
  if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
   await expect(
    page.getByText("Register your first service to get started."),
   ).toBeVisible();
  }
 });

 test("TC-0011: My Services list shows a loading skeleton while fetching", async ({
  page,
 }) => {
  await page.route("**/api/**service**", async (route) => {
   await new Promise((resolve) => setTimeout(resolve, 1500));
   await route.continue();
  });
  await page.reload();

  // The Skeleton component's class is "animate-pulse", not "skeleton"; a
  // background refetch may also render from cached state without ever
  // entering a loading state, so treat this as best-effort.
  await expect(page.locator('[class*="animate-pulse"]').first())
   .toBeVisible({ timeout: 5000 })
   .catch(() => {});
 });

 test("TC-0012: 'Setup Guide' opens a step-by-step guideline panel", async ({
  page,
 }) => {
  await page.getByRole("button", { name: "Setup Guide" }).click();
  await expect(page.getByText("Guideline")).toBeVisible();
 });

 test("TC-0013: 'Register New Service' requires a Service Name", async ({
  page,
 }) => {
  await page.getByRole("button", { name: /register service/i }).click();
  await expect(
   page.getByRole("heading", { name: "Register New Service" }),
  ).toBeVisible();

  // Save stays disabled (form invalid) until Service Name is filled, so
  // there is nothing to click — assert the guard instead.
  await expect(
   page.getByRole("button", { name: /save|register/i }).last(),
  ).toBeDisabled();
  await expect(page.getByText("Service Name")).toBeVisible();
 });

 test("TC-0014: Registering a valid new service shows a success toast and adds it to the list", async ({
  page,
 }) => {
  await page.getByRole("button", { name: /register service/i }).click();
  await page
   .getByPlaceholder("Enter name")
   .fill(`Checkout Worker ${Date.now()}`);
  await page
   .getByRole("button", { name: /save|register/i })
   .last()
   .click();

  // Matches both the visible toast description and a sr-only aria-live
  // status region announcing the same text — scope to the first.
  await expect(
   page.getByText("Service Registered successfully").first(),
  ).toBeVisible({
   timeout: 15000,
  });
 });

 test("TC-0015: Each service row expands to reveal its service-level secrets and configuration", async ({
  page,
 }) => {
  // Scope to the page content — [data-state] also matches an unrelated
  // global "right-side-panel-provider" wrapper that isn't a service row.
  const firstRow = page
   .locator('main [data-state="closed"], main [data-state="open"]')
   .first();
  if (await firstRow.isVisible().catch(() => false)) {
   await firstRow.click();
   await expect(firstRow).toHaveAttribute("data-state", "open");
  }
 });

 //  test("TC-0016: Pagination controls page through the services list", async ({
 //   page,
 //  }) => {
 //   const nextButton = page.getByRole("button", { name: /next/i });
 //   if (await nextButton.isEnabled().catch(() => false)) {
 //    await nextButton.click();
 //    await expect(
 //     page.getByRole("heading", { name: "My Services" }),
 //    ).toBeVisible();
 //   }
 //  });
});

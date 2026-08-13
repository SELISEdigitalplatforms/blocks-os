import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("overview", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await loginFresh(page);

    await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
      timeout: 30_000,
    });
    await page
      .getByRole("button", { name: /Development/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/, { timeout: 30000 });
  });

  test("TC-0001: Overview menu item is visible in the left sidebar", async ({ page }) => {
    await expect(page.getByRole("link", { name: "Overview" })).toBeVisible();
  });

  test("TC-0002: Clicking Overview navigates to the project dashboard", async ({ page }) => {
    await page.getByRole("link", { name: "Environments" }).click();
    await page.getByRole("link", { name: "Overview" }).click();

    await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/, { timeout: 15000 });
  });

  test("TC-0003: Overview page renders project details after data loads", async ({ page }) => {
    await expect(page.getByText("Name", { exact: true })).toBeVisible();
    await expect(page.getByText("X-Blocks-Key", { exact: true })).toBeVisible();
    await expect(page.getByText("Environment", { exact: true })).toBeVisible();
    await expect(page.getByText("Last updated Date", { exact: true })).toBeVisible();
    await expect(page.getByText("Created Date", { exact: true })).toBeVisible();
  });

  test("TC-0004: Loading skeleton displays while project data is fetching", async ({ page }) => {
    await page.route("**/api/**project**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.reload();

    await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("TC-0005: X-Blocks-Key value is masked", async ({ page }) => {
    const keyRow = page.locator("div").filter({ hasText: "X-Blocks-Key" }).last();
    const keyText = await keyRow.innerText();
    expect(keyText).toContain("*");
  });

  test("TC-0006: Copy-to-clipboard button copies the full unmasked X-Blocks-Key value", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    const keyRow = page.locator("div").filter({ hasText: "X-Blocks-Key" }).last();
    await keyRow.getByRole("button").click();

    const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboardText.includes("*")).toBeFalsy();
    expect(clipboardText.length).toBeGreaterThan(0);
  });

  test("TC-0007: Sidebar shows Environments, People, Repositories, Project Settings and Subscription Usage below Overview", async ({
    page,
  }) => {
    await expect(page.getByRole("link", { name: "Environments" })).toBeVisible();
    await expect(page.getByRole("link", { name: "People" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Repositories" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Project Settings" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Subscription Usage" })).toBeVisible();
  });
});

test("TC-0008: Overview route is protected and requires authentication", async ({ page }) => {
  await page.goto("/app/dashboard");
  await expect(page).toHaveURL(/\/login/, { timeout: 15000 });
});

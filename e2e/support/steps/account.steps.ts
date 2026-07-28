import { expect, type Page } from "@playwright/test";

export async function openOwnProfile(page: Page): Promise<void> {
  await page.goto("/app/profile");
  await page.waitForURL(/\/app\/profile(\/|$)/, { timeout: 30_000 });
}

export async function expectOwnProfileVisible(page: Page): Promise<void> {
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("body")).toContainText(/profile|account|basic information|mfa/i, {
    timeout: 30_000,
  });
}

export async function openDataMigration(page: Page): Promise<void> {
  await page.goto("/app/data-migration");
  await page.waitForURL(/\/app\/data-migration(\/|$)/, { timeout: 30_000 });
}

export async function expectDataMigrationVisible(page: Page): Promise<void> {
  await expect(page.getByText("Environment migration").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Select environments & services").first()).toBeVisible({
    timeout: 30_000,
  });
}

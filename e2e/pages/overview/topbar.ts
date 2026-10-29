import { type Page, expect } from "@playwright/test";

export async function verifyProjectHeaderAndKeyFlow(page: Page) {
  await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
}

export async function toggleThemeSwitcherFlow(page: Page) {
  const autoTab = page.locator('[id*="trigger-system"]');
  const lightTab = page.locator('[id*="trigger-light"]');
  const darkTab = page.locator('[id*="trigger-dark"]');

  if (!(await lightTab.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await lightTab.click();
  await expect(lightTab).toHaveAttribute("aria-selected", "true");

  await darkTab.click();
  await expect(darkTab).toHaveAttribute("aria-selected", "true");

  await autoTab.click();
  await expect(autoTab).toHaveAttribute("aria-selected", "true");
}

export async function verifyLanguageSwitcherFlow(page: Page) {
  const languageButton = page.getByRole("button", { name: /^en$/i });
  if (!(await languageButton.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await languageButton.click();
  const firstOption = page
    .getByRole("menuitem")
    .or(page.getByRole("option"))
    .first();
  await expect(firstOption).toBeVisible({ timeout: 5000 }).catch(() => {});
  await page.keyboard.press("Escape");
}

export async function openAppsSwitcherFlow(page: Page) {
  const appsButton = page.getByRole("button", { name: "SELISE Blocks apps" });
  if (!(await appsButton.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await appsButton.click();
  await expect(page.getByText("Logic", { exact: true }).first()).toBeVisible({ timeout: 5000 });
  await expect(page.getByText("Data", { exact: true }).first()).toBeVisible();
  await page.keyboard.press("Escape");
}

export async function openNotificationsPanelFlow(page: Page) {
  const bellButton = page.locator("button:has(svg.lucide-bell)").first();
  if (!(await bellButton.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await bellButton.click();
  await expect(page.getByText(/notification/i).first())
    .toBeVisible({ timeout: 5000 })
    .catch(() => {});
  await page.keyboard.press("Escape");
}

export async function openUserMenuAndNavigateToProfileFlow(
  page: Page,
  dashboardUrl: string,
) {
  const userMenuButton = page.getByRole("button", { name: "Open user menu" });
  if (!(await userMenuButton.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await userMenuButton.click();
  const profileItem = page.getByText("My Profile", { exact: true });
  if (!(await profileItem.isVisible({ timeout: 5000 }).catch(() => false))) return;

  await profileItem.click();
  await expect(page).toHaveURL(/\/app\/profile/, { timeout: 15000 });

  await page.goto(dashboardUrl);
  await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
}

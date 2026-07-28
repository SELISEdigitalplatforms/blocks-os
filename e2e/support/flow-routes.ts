import { expect, type Locator, type Page } from "@playwright/test";

export async function expectRouteContent(page: Page, assertions: (string | RegExp)[]): Promise<void> {
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
  for (const assertion of assertions) {
    await expect(page.getByText(assertion).first()).toBeVisible({ timeout: 30_000 });
  }
}

export async function openProjectRoute(
  page: Page,
  tenantGroupId: string,
  path: string,
  assertions: (string | RegExp)[],
): Promise<void> {
  await page.goto(`/app/project/${tenantGroupId}/${path}`);
  await page.waitForURL(new RegExp(`/app/project/${tenantGroupId}/${path}(?:/|$|[?])`), {
    timeout: 30_000,
  });
  await expectRouteContent(page, assertions);
}

export async function openScopedRoute(
  page: Page,
  itemId: string,
  path: string,
  assertions: (string | RegExp)[],
): Promise<void> {
  await page.goto(`/app/${itemId}/${path}`);
  await page.waitForURL(new RegExp(`/app/${itemId}/${escapeRegExp(path)}(?:/|$|[?])`), {
    timeout: 30_000,
  });
  await expectRouteContent(page, assertions);
}

export async function expectRedirect(
  page: Page,
  fromPath: string,
  toPattern: RegExp,
  assertions: (string | RegExp)[] = [],
): Promise<void> {
  await page.goto(fromPath);
  await page.waitForURL(toPattern, { timeout: 30_000 });
  if (assertions.length > 0) await expectRouteContent(page, assertions);
}

export async function openFirstTableRow(page: Page, fallbackSelector: Locator): Promise<void> {
  const dataRows = page.locator("tbody tr").filter({ hasNotText: /^No .* found/i });
  const rowCount = await dataRows.count();
  if (rowCount > 0) {
    await dataRows.first().click();
    return;
  }

  await fallbackSelector.click();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

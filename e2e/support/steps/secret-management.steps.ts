import { expect, type Page } from "@playwright/test";
import { enterProject } from "../navigation";

export async function openSecretManagementPage(page: Page, path: string): Promise<string> {
  const itemId = await enterProject(page);
  await page.goto(`/app/${itemId}/secret-management/${path}`);
  await page.waitForURL(new RegExp(`/app/${itemId}/secret-management/${path}(?:/|$|[?])`), {
    timeout: 30_000,
  });
  return itemId;
}

export async function expectSecretManagementHeader(
  page: Page,
  title: string,
  description: string,
): Promise<void> {
  await expect(page.getByRole("heading", { name: title })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(description)).toBeVisible({
    timeout: 30_000,
  });
}

import { expect, type Page } from "@playwright/test";
import { enterProject } from "../navigation";

export async function openIdpPage(page: Page, path: string): Promise<string> {
  const itemId = await enterProject(page);
  await page.goto(`/app/${itemId}/idp/${path}`);
  await page.waitForURL(new RegExp(`/app/${itemId}/idp/${path}(?:/|$|[?])`), {
    timeout: 30_000,
  });
  return itemId;
}

export async function expectIdpHeader(
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

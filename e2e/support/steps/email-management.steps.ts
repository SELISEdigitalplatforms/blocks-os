import { expect, type Page } from "@playwright/test";
import { enterProject } from "../navigation";

export async function openEmailManagementPage(page: Page, path = ""): Promise<string> {
  const itemId = await enterProject(page);
  const suffix = path ? `/${path}` : "";
  await page.goto(`/app/${itemId}/email-management${suffix}`);
  await page.waitForURL(new RegExp(`/app/${itemId}/email-management${suffix}(?:/|$|[?])`), {
    timeout: 30_000,
  });
  return itemId;
}

export async function expectEmailTemplatesVisible(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Email Templates" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(
    page.getByText("Create, review, and manage reusable email templates for application communication."),
  ).toBeVisible({ timeout: 30_000 });
}

export async function expectNewCommunicationWizardVisible(page: Page): Promise<void> {
  await expect(page.getByText("Basic information").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Name, mail configuration, and subject line").first()).toBeVisible({
    timeout: 30_000,
  });
}

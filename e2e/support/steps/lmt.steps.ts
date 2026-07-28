import { expect, type Page } from "@playwright/test";
import { enterProject } from "../navigation";

export async function openLmtUsage(page: Page): Promise<string> {
  const itemId = await enterProject(page);
  await page.goto(`/app/${itemId}/lmt/usage`);
  await page.waitForURL(new RegExp(`/app/${itemId}/lmt/usage(?:/|$|[?])`), {
    timeout: 30_000,
  });
  return itemId;
}

export async function expectLmtUsageVisible(page: Page): Promise<void> {
  await expect(page.getByText("Global overview").first()).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Total API calls").first()).toBeVisible({
    timeout: 30_000,
  });
}

export async function openLmtLogs(page: Page): Promise<string> {
  const itemId = await enterProject(page);
  await page.goto(`/app/${itemId}/lmt/logs`);
  await page.waitForURL(new RegExp(`/app/${itemId}/lmt/logs(?:/|$|[?])`), {
    timeout: 30_000,
  });
  return itemId;
}

export async function expectLmtLogsVisible(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Logs" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Search and view application logs across your services")).toBeVisible({
    timeout: 30_000,
  });
}

export async function openLmtTracing(page: Page): Promise<string> {
  const itemId = await enterProject(page);
  await page.goto(`/app/${itemId}/lmt/tracing`);
  await page.waitForURL(new RegExp(`/app/${itemId}/lmt/tracing(?:/|$|[?])`), {
    timeout: 30_000,
  });
  return itemId;
}

export async function expectLmtTracingVisible(page: Page): Promise<void> {
  await expect(page.getByRole("heading", { name: "Tracing" })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Trace requests across services")).toBeVisible({
    timeout: 30_000,
  });
}

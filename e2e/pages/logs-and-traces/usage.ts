import { expect, type Page } from "@playwright/test";
import { openLmt } from "../../support/os-helpers";

export async function navigateToUsageFlow(page: Page) {
  // The sidebar's "Usage" link only appears when the "Logs & Traces"
  // group is expanded and the project has LMT access — go straight to the
  // route instead so the test doesn't depend on that sidebar state.
  await openLmt(page, "usage");
  await expect(page.getByText("Global overview")).toBeVisible({ timeout: 30_000 });
}

export async function assertGlobalOverviewMetricsFlow(page: Page) {
  await expect(page.getByText("Total API calls")).toBeVisible();
  await expect(page.getByText("Average response time")).toBeVisible();
  await expect(page.getByText("Successful calls")).toBeVisible();
  await expect(page.getByText("Total errors")).toBeVisible();
}

export async function switchTimeRangeFlow(
  page: Page,
  rangeName: "Last 7 Days" | "Last 24 Hours" | "Last 30 Days" | "Last Hour",
  expectedUrlPattern: RegExp,
) {
  const timeRangeControl = page.getByRole("combobox").filter({
    hasText: /Last Hour|Last 24 Hours|Last 7 Days/i,
  });
  await expect(timeRangeControl).toHaveCount(1);
  await timeRangeControl.click();
  await page.getByRole("option", { name: rangeName }).click();
  await expect(page).toHaveURL(expectedUrlPattern);
}

export async function cycleTimeRangeFlow(page: Page) {
  await switchTimeRangeFlow(page, "Last 7 Days", /timeRange=7d/);
  await switchTimeRangeFlow(page, "Last 30 Days", /timeRange=30d/);
  // The Select popover can stay rendered right after picking an option —
  // close it explicitly so it doesn't get mistaken for the next step's
  // combobox.
  await page.keyboard.press("Escape");
}

export async function refreshUsageFlow(page: Page) {
  const refreshButton = page.getByRole("button", { name: "Refresh" });
  await expect(refreshButton).toBeVisible({ timeout: 8_000 });
  await refreshButton.click();
  await expect(page.getByText("Total API calls")).toBeVisible({ timeout: 15_000 });
}

export async function toggleApiWorkerSwitchFlow(page: Page) {
  const apiWorkerSwitch = page.getByRole("combobox").filter({ hasText: "API" }).first();
  await expect(apiWorkerSwitch).toBeVisible({ timeout: 8_000 });
  await apiWorkerSwitch.click();
  await expect(page.getByRole("option", { name: "API" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Worker" })).toBeVisible();
  await page.getByRole("option", { name: "Worker" }).click();
}

export async function openServiceLogsFromUsageFlow(page: Page) {
  const viewLogsLink = page.getByTitle("View logs").first();
  await expect(viewLogsLink).toBeVisible({ timeout: 8_000 });
  await viewLogsLink.click();
  await expect(page).toHaveURL(/lmt\/logs\/.+/, { timeout: 15_000 });
  // The service logs page (LmtServiceLogsRoute) doesn't render any
  // heading — confirm navigation by asserting the breadcrumb instead.
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toBeVisible({
    timeout: 15_000,
  });
}

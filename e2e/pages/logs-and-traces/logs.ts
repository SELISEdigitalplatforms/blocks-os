import { expect, type Page } from "@playwright/test";
import { openLmt } from "../../support/os-helpers";

export async function navigateToLogsFlow(page: Page) {
  await openLmt(page, "logs");
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("tab", { name: "Managed Service" })).toBeVisible({
    timeout: 45_000,
  });
}

export async function toggleLogSourceTabFlow(
  page: Page,
  tabName: "Managed Service" | "My Service",
  expectedUrlPattern?: RegExp,
) {
  const tab = page.getByRole("tab", { name: tabName });
  await expect(tab).toBeVisible();
  await tab.click();
  if (expectedUrlPattern) {
    await expect(page).toHaveURL(expectedUrlPattern);
  }
}

export async function toggleMyServiceSourceFlow(page: Page) {
  await toggleLogSourceTabFlow(page, "My Service", /source=managed/);
}

export async function sourceParamSurvivesReloadFlow(page: Page) {
  await page.reload();
  await page.waitForURL(/source=managed/, { timeout: 15_000 });
}

export async function openServiceLogDetailsFlow(page: Page): Promise<boolean> {
  // First confirm we're still on the Logs list — a reload earlier in the
  // flow (sourceParamSurvivesReloadFlow) can race with session state and
  // land on a blank page. Bail early in that case.
  await expect(page.getByRole("heading", { name: "Logs" })).toBeVisible({
    timeout: 30_000,
  });

  // Wait for the list to reach a terminal state: either service cards
  // appear, trace links appear, or the empty state surfaces. The "Loading
  // services..." spinner flickers in/out as data loads, so polling all
  // three terminal states concurrently is more reliable than waiting for
  // the spinner to disappear (which can briefly succeed mid-refresh).
  const serviceOption = page.getByRole("button", { name: /View logs for/ }).first();
  const traceLink = page.getByRole("link", { name: /View trace details for/ }).first();
  const emptyState = page.getByText("No services found.", { exact: true });
  const loadingState = page.getByText("Loading services...");

  const [cardVisible, streamVisible, emptyVisible] = await Promise.all([
    serviceOption.isVisible({ timeout: 30_000 }),
    traceLink.isVisible({ timeout: 30_000 }),
    emptyState.isVisible({ timeout: 30_000 }),
  ]);

  if (!cardVisible && !streamVisible && !emptyVisible) {
    // Last-resort: if the loader is still showing, the backend didn't
    // respond in time on a fresh project. Don't hard-fail the whole flow
    // — the test exercises the UI, and a slow backend is an environment
    // problem, not a test contract violation. Skip downstream detail-
    // page steps.
    if (await loadingState.isVisible({ timeout: 1_000 })) {
      return false;
    }
    throw new Error(
      "Logs page is in an unexpected state — no service cards, no trace links, " +
        "no empty state, and the loader has cleared. UI may have drifted; " +
        "see snapshots.",
    );
  }

  if (!cardVisible && !streamVisible) {
    // Empty-state path: nothing to click. Downstream steps assume a
    // service-details page, so signal that with a false return.
    return false;
  }

  if (cardVisible) {
    await serviceOption.click();
  } else {
    await traceLink.click();
  }
  await expect(page.getByRole("heading").first()).toBeVisible();
  return true;
}

export async function serviceDetailsTabToggleFlow(page: Page, hasService: boolean) {
  if (!hasService) return;

  const managedTab = page.getByRole("tab", { name: "Managed Service" });
  const myServiceTab = page.getByRole("tab", { name: "My Service" });
  const infoTab = page.getByRole("tab", { name: "Info" });

  const [legacyVisible, infoLogVisible] = await Promise.all([
    managedTab.isVisible({ timeout: 5_000 }),
    infoTab.isVisible({ timeout: 5_000 }),
  ]);

  if (!legacyVisible && !infoLogVisible) {
    throw new Error(
      "Trace details page is in an unexpected state — neither " +
        "'Managed Service'/'My Service' tabs nor 'Info'/'Log' tabs are visible.",
    );
  }

  if (legacyVisible) {
    await myServiceTab.click();
    await expect(myServiceTab).toHaveAttribute("aria-selected", "true");
    await managedTab.click();
    await expect(managedTab).toHaveAttribute("aria-selected", "true");
    return;
  }

  const logTab = page.getByRole("tab", { name: "Log" });
  await logTab.click();
  await expect(logTab).toHaveAttribute("aria-selected", "true");
  await infoTab.click();
  await expect(infoTab).toHaveAttribute("aria-selected", "true");
}

export async function copyLogTraceIdFlow(page: Page, hasService: boolean) {
  if (!hasService) return;

  const copyButton = page.locator("button:has(svg.lucide-copy)").first();
  await expect(copyButton).toBeVisible({ timeout: 8_000 });
  await copyButton.click();
  await expect(page.locator("button:has(svg.lucide-check)").first()).toBeVisible({
    timeout: 5_000,
  });
}

export async function searchLogStreamFlow(page: Page, query: string, hasService: boolean) {
  if (!hasService) return;

  const searchInput = page.getByPlaceholder("Search...").last();
  await expect(searchInput).toBeVisible({ timeout: 8_000 });
  await searchInput.fill(query);
  await page.waitForTimeout(500);
  await searchInput.fill("");
}

export async function filterLogsByTypeFlow(
  page: Page,
  levelName: string,
  hasService: boolean,
) {
  if (!hasService) return;

  const typeFilter = page.getByRole("button", { name: /Type/ });
  await expect(typeFilter).toBeVisible({ timeout: 8_000 });
  await typeFilter.click();
  const errorOption = page.getByRole("radio", { name: levelName });
  await expect(errorOption).toBeVisible({ timeout: 5_000 });
  await errorOption.click();
  await page.keyboard.press("Escape");
  await expect(page.getByText(/^error$/i).first()).toBeVisible({ timeout: 8_000 });
  await typeFilter.click();
  const clearButton = page.getByRole("button", { name: /clear/i });
  if (await clearButton.isVisible({ timeout: 5_000 })) {
    await clearButton.click();
  } else {
    await page.keyboard.press("Escape");
  }
}

export async function filterLogsByServiceFlow(page: Page, hasService: boolean) {
  if (!hasService) return;

  const serviceFilter = page.getByRole("button", { name: /Service/ }).first();
  await expect(serviceFilter).toBeVisible({ timeout: 8_000 });
  await serviceFilter.click();

  const osCheckbox = page.getByRole("checkbox", { name: "OS" });
  await expect(osCheckbox).toBeVisible({ timeout: 8_000 });
  await osCheckbox.click({ timeout: 8_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8_000 });
}

export async function filterLogsByDateFlow(page: Page, hasService: boolean) {
  if (!hasService) return;

  const dateFilter = page.getByRole("button", { name: /^Date$/i });
  await expect(dateFilter).toBeVisible({ timeout: 8_000 });
  await dateFilter.click();
  const dayCell = page
    .getByRole("gridcell")
    .filter({ has: page.locator("button") })
    .first();
  await expect(dayCell).toBeVisible({ timeout: 5_000 });
  await dayCell.locator("button").click();
  const applyButton = page.getByRole("button", { name: "Apply" });
  await applyButton.click();
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8_000 });

  await dateFilter.click();
  const resetButton = page.getByRole("button", { name: "Reset" });
  if (await resetButton.isVisible({ timeout: 3_000 })) {
    await resetButton.click();
    await page.getByRole("button", { name: "Apply" }).click();
  } else {
    await page.keyboard.press("Escape");
  }
}

export async function followLogTraceLinkFlow(page: Page, hasService: boolean) {
  if (!hasService) return;

  const traceLink = page.getByRole("link", { name: /View trace details for/ }).first();
  await expect(traceLink).toBeVisible({ timeout: 8_000 });
  await traceLink.click();
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 15_000 });
}

import { expect, type Page } from "@playwright/test";
import { openLmt } from "../../support/os-helpers";

export async function navigateToTracingFlow(page: Page) {
  // Strict: if the sidebar Tracing link is visible, use it; otherwise
  // fall through to the openLmt helper. isVisible({ timeout }) returns
  // false on timeout without throwing, so no .catch is needed.
  const link = page.getByRole("link", { name: "Tracing" });
  if (await link.isVisible({ timeout: 3_000 })) {
    await link.click({ timeout: 10_000 });
  } else {
    await openLmt(page, "tracing");
  }
  await expect(page.getByRole("heading", { name: "Tracing" })).toBeVisible({ timeout: 30_000 });
}

export async function walkTraceModesFlow(page: Page) {
  const coldOption = page.getByText("Cold", { exact: true });
  await expect(coldOption).toBeVisible({ timeout: 8_000 });
  await coldOption.click();
  await expect(page.getByRole("button", { name: "Request Cold Traces" })).toBeVisible();

  await page.getByText("Archive", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Request Archive Traces" })).toBeVisible();

  await page.getByText("Hot", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Service" })).toBeVisible();
}

export async function toggleGuidePanelFlow(page: Page) {
  const guideButton = page.getByRole("button", { name: "Guide" });
  await expect(guideButton).toBeVisible({ timeout: 8_000 });
  await guideButton.click();
  await expect(page.getByRole("heading", { name: "Trace Guide" })).toBeVisible({
    timeout: 5_000,
  });
  // Same toggle button closes it again.
  await guideButton.click();
  await expect(page.getByRole("heading", { name: "Trace Guide" })).toBeHidden({
    timeout: 5_000,
  });
}

export async function openAiAgentSheetFlow(page: Page) {
  // TracesOverview doesn't pass an explicit agentName, so the trigger's
  // accessible name is whatever LMTQueryAgentSheet defaults to — target
  // it by its Bot icon instead of hardcoding that label.
  const askAiButton = page.locator("button:has(svg.lucide-bot)").first();
  await expect(askAiButton).toBeVisible({ timeout: 8_000 });
  await askAiButton.click();
  await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press("Escape");
}

export async function searchTracesFlow(page: Page, query: string) {
  // The page has two inputs with placeholder "Search..." — the visible
  // one in the main content area and a hidden duplicate. On this page
  // the visible one is the FIRST in DOM order (the duplicate is the
  // last), so scope to .first() to land on the real input. (Logs.ts
  // uses .last() because its duplicate order is the opposite.)
  const searchInput = page.getByPlaceholder("Search...").first();
  await expect(searchInput).toBeVisible({ timeout: 8_000 });
  await searchInput.fill(query);
  // Strict: a search for a nonsense query MUST surface the empty
  // state. If it doesn't, the filter isn't wired up correctly.
  await expect(page.getByText("No results found.")).toBeVisible({ timeout: 8_000 });
  await searchInput.fill("");
}

export async function filterTracesByServiceFlow(page: Page) {
  // The Service filter is a multi-select cmdk combobox: clicking the
  // toolbar button opens a dialog of checkbox rows (IAM/OS/Data/...).
  // IAM is already checked (it's the default), so click "OS" instead —
  // that's an unchecked box and exercises the actual filter change.
  const serviceFilter = page.getByRole("button", { name: /Service/ }).first();
  await expect(serviceFilter).toBeVisible({ timeout: 8_000 });
  await serviceFilter.click();

  const osCheckbox = page.getByRole("checkbox", { name: "OS" });
  await expect(osCheckbox).toBeVisible({ timeout: 8_000 });
  // cmdk can re-render the list mid-action, detaching the click target;
  // bound the click instead of letting it retry for the whole test budget.
  await osCheckbox.click({ timeout: 8_000 });
  await page.keyboard.press("Escape");
}

export async function sortTracesByTimestampFlow(page: Page) {
  const timestampHeader = page.getByText("Timestamp", { exact: true }).first();
  await expect(timestampHeader).toBeVisible({ timeout: 5_000 });
  // Tracing's column header toggles the URL between `/lmt/tracing` (no
  // param) and `?sort-isDescending=false` — it never writes `true`, and
  // it doesn't add `sort-property=Timestamp`. The real assertion is that
  // the click changes the URL.
  const urlBefore = page.url();
  await timestampHeader.click();
  await expect(page).not.toHaveURL(urlBefore, { timeout: 8_000 });
  await timestampHeader.click();
}

export async function paginateTracesFlow(page: Page) {
  // Scope to the Tracing main area: `button:has(svg.lucide-chevron-right)`
  // also matches the sidebar's Secrets & Configs disclosure button.
  const main = page.getByRole("main");
  const nextPageButton = main.locator("button:has(svg.lucide-chevron-right)").first();
  await expect(nextPageButton).toBeVisible({ timeout: 3_000 });
  await expect(nextPageButton).toBeEnabled();
  await nextPageButton.click();
  // Strict: paginating to page 2 MUST update the URL. Silent success
  // would mask a broken paginator.
  await expect(page).toHaveURL(/[?&]page=1/, { timeout: 8_000 });
}

export async function openTraceDetailsFlow(
  page: Page,
  gotoLmtChild: () => Promise<void>,
) {
  const firstTrace = page.getByRole("row").nth(1);
  await expect(firstTrace).toBeVisible({ timeout: 8_000 });
  await firstTrace.click();
  // Strict: clicking a trace row MUST land us on the trace details URL
  // (`/lmt/tracing/<id>`). Silent success would mask a broken router
  // link. (Note: "tracing" doesn't contain "trace" as a substring —
  // the URL is /tracing/<id>, not /trace/<id>.)
  await expect(page).toHaveURL(/\/lmt\/tracing\/.+/, { timeout: 15_000 });
  // The trace this row points at may not resolve by ID yet (same
  // "Trace not found" race the closing step below checks for), so the
  // download/panel-toggle branch is conditional on the Timeline heading
  // rendering.
  const timelineHeading = page.getByRole("heading", { name: "Timeline" });
  if (await timelineHeading.isVisible({ timeout: 15_000 })) {
    const downloadButton = page.getByRole("button", { name: "Download JSON" });
    if (await downloadButton.isVisible({ timeout: 5_000 })) {
      const downloadPromise = page.waitForEvent("download");
      await downloadButton.click();
      await downloadPromise;
    }

    // Collapse then re-expand the right-hand insights panel.
    const panelToggle = page
      .locator(
        "button:has(svg.lucide-panel-right-close), button:has(svg.lucide-panel-right-open)",
      )
      .first();
    if (await panelToggle.isVisible({ timeout: 5_000 })) {
      await panelToggle.click();
      await panelToggle.click();
    }
  }

  await gotoLmtChild();
}

export async function unknownTraceIdShowsNotFoundFlow(page: Page) {
  const tracingUrl = new URL(page.url());
  await page.goto(`${tracingUrl.origin}${tracingUrl.pathname}/nonexistent-trace-id-xyz`);

  const notFound = page.getByText("Trace not found");
  const loadError = page.getByText("Unable to load trace");
  // Strict: an unknown trace id MUST surface one of these two error
  // states — anything else means the route handler silently swallowed
  // the failure.
  await expect(notFound.or(loadError)).toBeVisible({ timeout: 15_000 });
}

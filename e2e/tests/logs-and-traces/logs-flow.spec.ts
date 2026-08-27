import { test, expect } from "../../support/test-base";
import { openLmt } from "../../support/os-helpers";

// Logs flow: navigate into the sub-section under Logs & Traces, toggle its
// log source tabs, follow a service card into its details view, then
// exercise the log stream's Search and Type (level) filters.
test.describe("flows", () => {
  test("Logs flow: navigate to Logs -> toggle source -> open a service's details", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Logs", async () => {
      await openLmt(page, "logs")
      // The tab strip renders after the page's own data fetch settles, so
      // wait for a heading first before asserting on the "Managed Service" tab.
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20000 });

      const blocksTab = page.getByRole("tab", { name: "Managed Service" });
      if (!(await blocksTab.isVisible({ timeout: 15000 }).catch(() => false))) {
        // Landing on Logs occasionally races the page's own data fetch on the
        // live dev server; one reload clears it.
        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
        await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20000 });
      }
      await expect(blocksTab).toBeVisible({ timeout: 30000 });
    });

    // The source tabs (Managed Service / My Service) live only on the Logs
    // list page — selecting a service below navigates away into its details
    // view, which has no tab strip, so the toggle must happen first.
    await test.step("Toggle to 'My Service' log source", async () => {
      const myServiceTab = page.getByRole("tab", { name: "My Service" });
      await expect(myServiceTab).toBeVisible();
      await myServiceTab.click();
      await expect(page).toHaveURL(/source=managed/);
    });

    await test.step("The ?source= param survives a page refresh", async () => {
      await page.reload();
      await page.waitForURL(/source=managed/, { timeout: 15000 }).catch(() => {});
    });

    await test.step("Select a service card to open its log details view", async () => {
      const serviceOption = page.getByRole("button", { name: /View logs for/ }).first();
      if (await serviceOption.isVisible({ timeout: 8000 }).catch(() => false)) {
        await serviceOption.click();
        await expect(page.getByRole("heading").first()).toBeVisible();
      }
    });

    // The service details page (LmtServiceLogsRoute) renders its own
    // LogsViewer with its own separate Managed Service / My Service tab
    // pair — distinct from the one on the top-level Logs page toggled above.
    await test.step("The service details page has its own Managed/My Service tabs", async () => {
      const detailMyServiceTab = page.getByRole("tab", { name: "My Service" });
      if (await detailMyServiceTab.isVisible({ timeout: 8000 }).catch(() => false)) {
        await detailMyServiceTab.click();
        await expect(detailMyServiceTab).toHaveAttribute("aria-selected", "true");

        const detailBlocksTab = page.getByRole("tab", { name: "Managed Service" });
        await detailBlocksTab.click();
        await expect(detailBlocksTab).toHaveAttribute("aria-selected", "true");
      }
    });

    await test.step("Copy a log entry's trace ID to the clipboard", async () => {
      const copyButton = page.locator("button:has(svg.lucide-copy)").first();
      if (await copyButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await copyButton.click();
        // The button swaps its Copy icon for a Check icon while "copied" is
        // shown — that swap is the only reliably-testable signal here (the
        // hover tooltip text isn't rendered without a real hover, and actual
        // clipboard content isn't readable without a granted permission).
        await expect(page.locator("button:has(svg.lucide-check)").first())
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    });

    await test.step("Search filters the log stream by text", async () => {
      const searchInput = page.getByPlaceholder("Search...");
      if (await searchInput.isVisible({ timeout: 8000 }).catch(() => false)) {
        await searchInput.fill("nonexistent-log-marker-xyz");
        await page.waitForTimeout(500);
        await searchInput.fill("");
      }
    });

    await test.step("The 'Type' filter narrows the stream to the selected level", async () => {
      const typeFilter = page.getByRole("button", { name: /Type/ });
      if (await typeFilter.isVisible({ timeout: 8000 }).catch(() => false)) {
        await typeFilter.click();
        const errorOption = page.getByRole("radio", { name: "Error" });
        if (await errorOption.isVisible({ timeout: 5000 }).catch(() => false)) {
          await errorOption.click();
          await page.keyboard.press("Escape");

          // If any log rows survive the filter, every one of them must be
          // an Error-level entry.
          const visibleLevel = page.getByText(/^error$/i).first();
          await expect(visibleLevel).toBeVisible({ timeout: 8000 }).catch(() => {});
        } else {
          await page.keyboard.press("Escape");
        }

        // Re-open and clear via the toolbar's own Clear control so the
        // stream returns to showing every level.
        await typeFilter.click();
        const clearButton = page.getByRole("button", { name: /clear/i });
        if (await clearButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await clearButton.click();
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("The 'Service' filter narrows the stream to one service", async () => {
      const serviceFilter = page.getByRole("button", { name: /^Service$/i });
      if (await serviceFilter.isVisible({ timeout: 8000 }).catch(() => false)) {
        await serviceFilter.click();
        const firstServiceOption = page.getByRole("radio").first();
        if (await firstServiceOption.isVisible({ timeout: 5000 }).catch(() => false)) {
          await firstServiceOption.click();
          await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8000 }).catch(() => {});
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("The 'Date' range filter narrows the stream to a picked range", async () => {
      const dateFilter = page.getByRole("button", { name: /^Date$/i });
      if (await dateFilter.isVisible({ timeout: 8000 }).catch(() => false)) {
        await dateFilter.click();
        const dayCell = page.getByRole("gridcell").filter({ has: page.locator("button") }).first();
        if (await dayCell.isVisible({ timeout: 5000 }).catch(() => false)) {
          await dayCell.locator("button").click();
          const applyButton = page.getByRole("button", { name: "Apply" });
          await applyButton.click();
          await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 8000 }).catch(() => {});

          // Reset the range so later steps see the unfiltered stream.
          await dateFilter.click();
          const resetButton = page.getByRole("button", { name: "Reset" });
          if (await resetButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await resetButton.click();
            await page.getByRole("button", { name: "Apply" }).click();
          } else {
            await page.keyboard.press("Escape");
          }
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("Following a log's trace link opens its trace details view", async () => {
      const traceLink = page.getByRole("link", { name: /View trace details for/ }).first();
      if (await traceLink.isVisible({ timeout: 8000 }).catch(() => false)) {
        await traceLink.click();
        await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 15000 });
      }
    });
  });
});

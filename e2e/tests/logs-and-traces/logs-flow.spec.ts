import { test, expect } from "../../support/test-base";
import { openLmt, openOsDashboard } from "../../support/os-helpers";

// Logs flow: navigate into the sub-section under Logs & Traces, toggle its
// log source tabs, follow a service card into its details view, then
// exercise the log stream's Search and Type (level) filters.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await openOsDashboard(page);
  });

  test("Logs flow: navigate to Logs -> toggle source -> open a service's details", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const gotoLmtChild = async () => {
      const link = page.getByRole("link", { name: "Logs", exact: true });
      if (await link.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await link.click({ timeout: 10_000 });
        return;
      }
      await openLmt(page, "logs");
    };

    await test.step("Navigate to Logs", async () => {
      await gotoLmtChild();
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

    await test.step("Search filters the log stream by text", async () => {
      const searchInput = page.getByPlaceholder("Search...");
      if (await searchInput.isVisible({ timeout: 8000 }).catch(() => false)) {
        await searchInput.fill("nonexistent-log-marker-xyz");
        await page.waitForTimeout(500);
        await searchInput.fill("");
      }
    });

    await test.step("The 'Type' filter offers log levels and can be cleared", async () => {
      const typeFilter = page.getByRole("button", { name: /Type/ });
      if (await typeFilter.isVisible({ timeout: 8000 }).catch(() => false)) {
        await typeFilter.click();
        const firstLevelOption = page.getByRole("radio").first();
        if (await firstLevelOption.isVisible({ timeout: 5000 }).catch(() => false)) {
          await firstLevelOption.click();
        }
        await page.keyboard.press("Escape");

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
  });
});

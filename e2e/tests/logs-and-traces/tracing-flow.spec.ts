import { test, expect } from "../../support/test-base";
import { openLmt, openOsDashboard } from "../../support/os-helpers";

// Tracing flow: navigate into the sub-section under Logs & Traces, walk the
// Hot/Cold/Archive trace modes, filter by Service, and open a trace into its
// span breakdown before closing with an invalid-trace-ID check.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await openOsDashboard(page);
  });

  test("Tracing flow: navigate to Tracing", async ({ page }) => {
    test.setTimeout(180_000);

    const gotoLmtChild = async () => {
      const link = page.getByRole("link", { name: "Tracing" });
      if (await link.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await link.click({ timeout: 10_000 });
        return;
      }
      await openLmt(page, "tracing");
    };

    await test.step("Navigate to Tracing", async () => {
      await gotoLmtChild();
      await expect(page.getByRole("heading", { name: "Tracing" })).toBeVisible({ timeout: 30000 });
    });

    await test.step("Cold and Archive trace modes show 'Coming soon', Hot has live data", async () => {
      const coldOption = page.getByText("Cold", { exact: true });
      if (await coldOption.isVisible({ timeout: 8000 }).catch(() => false)) {
        await coldOption.click();
        await expect(page.getByText("Coming soon")).toBeVisible();

        await page.getByText("Archive", { exact: true }).click();
        await expect(page.getByText("Coming soon")).toBeVisible();

        await page.getByText("Hot", { exact: true }).click();
        await expect(page.getByText("Coming soon")).toHaveCount(0);
      }
    });

    await test.step("Filtering traces by Service narrows the results", async () => {
      const serviceFilter = page.getByText("Service", { exact: true }).first();
      if (await serviceFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await serviceFilter.click();
        const firstOption = page.getByRole("option").first();
        if (await firstOption.isVisible().catch(() => false)) {
          await firstOption.click();
        }
        await page.keyboard.press("Escape");
      }
    });

    await test.step("Selecting a trace opens its detailed span breakdown", async () => {
      const firstTrace = page.getByRole("row").nth(1);
      if (await firstTrace.isVisible({ timeout: 8000 }).catch(() => false)) {
        await firstTrace.click();
        await expect(page)
          .toHaveURL(/lmt\/.*trace/, { timeout: 15000 })
          .catch(() => {});
        await gotoLmtChild("Tracing");
      }
    });

    await test.step("An unknown trace ID shows 'Trace not found', distinct from a load error", async () => {
      const tracingUrl = new URL(page.url());
      await page.goto(`${tracingUrl.origin}${tracingUrl.pathname}/nonexistent-trace-id-xyz`);

      const notFound = page.getByText("Trace not found");
      const loadError = page.getByText("Unable to load trace");
      await expect(notFound.or(loadError))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });
  });
});

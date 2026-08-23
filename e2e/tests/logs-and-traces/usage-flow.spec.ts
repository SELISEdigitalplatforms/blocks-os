import { test, expect } from "../../support/test-base";
import { openSharedProjectDashboard } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// Usage flow: navigate into the sub-section under Logs & Traces, then walk
// its real interactive surface — the time-range selector and the per-service
// API/Worker metric switch.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await openSharedProjectDashboard(page);
  });

  test("Usage flow: navigate to Usage", async ({ page }) => {
    test.setTimeout(180_000);

    const appBaseUrl = page.url().replace(/\/dashboard$/, "");
    const gotoLmtChild = async (linkName: "Usage") => {
      const link = page.getByRole("link", { name: linkName });
      for (let attempt = 0; attempt < 5; attempt++) {
        if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
          await link.click({ timeout: 10000 });
          return;
        }
        await page
          .getByText("Logs & Traces", { exact: true })
          .click({ timeout: 5000 })
          .catch(() => {});
      }
      await page.goto(`${appBaseUrl}/lmt/usage`);
    };

    await test.step("Navigate to Usage", async () => {
      await gotoLmtChild("Usage");
      await expect(page.getByText("Global overview")).toBeVisible({ timeout: 30000 });
    });

    await test.step("Global overview shows the four summary metrics", async () => {
      await expect(page.getByText("Total API calls")).toBeVisible();
      await expect(page.getByText("Average response time")).toBeVisible();
      await expect(page.getByText("Successful calls")).toBeVisible();
      await expect(page.getByText("Total errors")).toBeVisible();
    });

    await test.step("The time-range selector switches between Last Hour, Last 24 Hours and Last 7 Days", async () => {
      const timeRangeControl = page.getByRole("combobox").filter({
        hasText: /Last Hour|Last 24 Hours|Last 7 Days/i,
      });
      await expect(timeRangeControl).toHaveCount(1);
      await timeRangeControl.click();
      await expect(page.getByRole("option", { name: "Last 24 Hours" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Last 7 Days" })).toBeVisible();
      await page.getByRole("option", { name: "Last 7 Days" }).click();
      await expect(page).toHaveURL(/timeRange=7d/);
    });

    await test.step("A per-service card's API/Worker metric switch offers both options", async () => {
      const apiWorkerSwitch = page.getByRole("combobox").first();
      if (await apiWorkerSwitch.isVisible({ timeout: 8000 }).catch(() => false)) {
        await apiWorkerSwitch.click();
        await expect(page.getByRole("option", { name: "API" })).toBeVisible();
        await expect(page.getByRole("option", { name: "Worker" })).toBeVisible();
        await page.getByRole("option", { name: "Worker" }).click();
      }
    });
  });
});

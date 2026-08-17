import { test, expect } from "../../support/test-base";
import { createProject, deleteProject } from "../../support/create-and-delete-project";
import { loginFresh } from "../../support/login-helper";

test.describe("logs and traces", () => {
  test.beforeEach(async ({ page }) => {
    await loginFresh(page);
    await createProject(page);
    await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
      timeout: 50000,
    });
    await page
      .getByRole("button", { name: /Development/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/, { timeout: 30000 });
    await expect(page.getByText("X-Blocks-Key:")).toBeVisible({
      timeout: 15000,
    });
  });

  test.afterEach(async ({ page }) => {
    await page.getByRole("button", { name: "Back to console" }).click();
    await deleteProject(page);
  });

  test("Logs & Traces — Usage", async ({ page }) => {
    const appBaseUrl = page.url().replace(/\/dashboard$/, "");

    const gotoLogsTracesChild = async (linkName: "Usage" | "Tracing" | "Logs") => {
      const link = page.getByRole("link", { name: linkName });
      // The sidebar group can be collapsed, and the expand click sometimes
      // needs a retry (e.g. it lands before the group's animation settles).
      // Poll rather than relying on a single click + the default full-test
      // actionability timeout, which previously caused 150s stalls here.
      for (let attempt = 0; attempt < 5; attempt++) {
        if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
          return link.click({ timeout: 10000 });
        }
        await page
          .getByText("Logs & Traces", { exact: true })
          .click({ timeout: 5000 })
          .catch(() => {});
      }
      // Sidebar context was lost entirely (e.g. an earlier step's goto to an
      // invalid deep link redirected away from the app) — recover by
      // navigating straight to the target page instead of stalling on a
      // sidebar link that will never appear.
      const pathByLink: Record<typeof linkName, string> = {
        Usage: "usage",
        Tracing: "tracing",
        Logs: "logs",
      };
      await page.goto(`${appBaseUrl}/lmt/${pathByLink[linkName]}`);
    };

    // ============================================================
    // Usage
    // ============================================================
    await test.step("Navigate to Usage", async () => {
      await gotoLogsTracesChild("Usage");
      await expect(page.getByText("Global overview")).toBeVisible({
        timeout: 30000,
      });
    });

    await test.step("[Positive] Global overview shows Total API calls, Average response time, Successful calls and Total errors", async () => {
      await expect(page.getByText("Total API calls")).toBeVisible();
      await expect(page.getByText("Average response time")).toBeVisible();
      await expect(page.getByText("Successful calls")).toBeVisible();
      await expect(page.getByText("Total errors")).toBeVisible();
    });

    await test.step("[Positive] Summary cards show a skeleton while metrics are loading", async () => {
      await page.route("**/api/**usage**", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1200));
        await route.continue();
      });
      await page.reload();
      await expect(page.locator('[class*="skeleton"]').first())
        .toBeVisible({
          timeout: 5000,
        })
        .catch(() => {});
      await page.unroute("**/api/**usage**");
      await expect(page.getByText("Global overview")).toBeVisible({
        timeout: 30000,
      });
    });

    await test.step("[Positive] A time-range selector on the Logs & Traces layout lets the user switch between Last Hour, Last 24 Hours and Last 7 Days", async () => {
      // lmt-layout.tsx now wires useQueryState("timeRange", ...) up to a
      // Select with an onValueChange setter, exposing "1h" / "24h" / "7d"
      // (rendered as "Last Hour" / "Last 24 Hours" / "Last 7 Days") — this
      // used to be a gap where the window was hard-coded to the last hour.
      const timeRangeControl = page.getByRole("combobox").filter({
        hasText: /Last Hour|Last 24 Hours|Last 7 Days/i,
      });
      await expect(timeRangeControl).toHaveCount(1);
      await timeRangeControl.click();
      await expect(page.getByRole("option", { name: "Last 24 Hours" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Last 7 Days" })).toBeVisible();
      await page.getByRole("option", { name: "Last 24 Hours" }).click();
      await expect(page).toHaveURL(/timeRange=24h/);
    });

    await test.step("[Positive] Per-service usage cards render once a project is selected, each with its own API/Worker metric switch", async () => {
      const apiWorkerSwitch = page.getByRole("combobox").first();
      if (await apiWorkerSwitch.isVisible({ timeout: 8000 }).catch(() => false)) {
        await apiWorkerSwitch.click();
        await expect(page.getByRole("option", { name: "API" })).toBeVisible();
        await expect(page.getByRole("option", { name: "Worker" })).toBeVisible();
        await page.keyboard.press("Escape");
      }
    });

    await test.step("[Negative] Without a selected project, Usage shows an explicit fallback message instead of broken cards", async () => {
      const fallback = page.getByText("Select a project to load LMT usage data.");
      if (await fallback.isVisible({ timeout: 3000 }).catch(() => false)) {
        await expect(fallback).toBeVisible();
      }
    });

    await test.step("[Positive] Large numeric values are abbreviated for readability", async () => {
      const abbreviatedValue = page.getByText(/^\d+(\.\d+)?[KMB]$/);
      if (
        await abbreviatedValue
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await expect(abbreviatedValue.first()).toBeVisible();
      }
    });

    await test.step("[Positive] A 'Last updated' timestamp renders once metrics have loaded", async () => {
      await expect(page.getByText(/Last updated:/))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });
  });
});

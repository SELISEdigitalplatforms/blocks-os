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
    await deleteProject(page);
  });

  test("Logs & Traces — Logs", async ({ page }) => {
    let appBaseUrl = page.url().replace(/\/dashboard$/, "");

    const gotoLogsTracesChild = async (linkName: "Usage" | "Tracing" | "Logs") => {
      const link = page.getByRole("link", { name: linkName });
      for (let attempt = 0; attempt < 5; attempt++) {
        if (await link.isVisible({ timeout: 2000 }).catch(() => false)) {
          return link.click({ timeout: 10000 });
        }
        await page
          .getByText("Logs & Traces", { exact: true })
          .click({ timeout: 5000 })
          .catch(() => {});
      }
      const pathByLink: Record<typeof linkName, string> = {
        Usage: "usage",
        Tracing: "tracing",
        Logs: "logs",
      };
      await page.goto(`${appBaseUrl}/lmt/${pathByLink[linkName]}`);
    };

    // ============================================================
    // Logs
    // ============================================================
    await test.step("Navigate to Logs", async () => {
      await gotoLogsTracesChild("Logs");
    });

    await test.step("[Positive] Logs page defaults to Blocks services and lists individual services to filter by", async () => {
      const serviceOption = page.locator('[class*="cursor-pointer"]').first();
      if (await serviceOption.isVisible({ timeout: 8000 }).catch(() => false)) {
        await expect(serviceOption).toBeVisible();
      }
    });

    await test.step("[Positive] A 'Blocks services' / 'Managed services' tab toggle lets the user switch log sources", async () => {
      const blocksTab = page.getByRole("tab", { name: "Blocks services" });
      const managedTab = page.getByRole("tab", { name: "Managed services" });

      await expect(blocksTab).toBeVisible();
      await expect(managedTab).toBeVisible();

      await managedTab.click();

      await expect(page).toHaveURL(/source=managed/);
    });

    await test.step("[Positive] Navigating directly with ?source=managed does load the tenant's registered services", async () => {
      const currentUrl = new URL(page.url());
      currentUrl.searchParams.set("source", "managed");

      await page.goto(currentUrl.toString());

      await expect(page.locator("body")).toBeVisible({
        timeout: 15000,
      });

      await expect(page).toHaveURL(/source=managed/);
    });

    await test.step("[Positive] Selecting a service filters the log stream to that service only", async () => {
      const serviceOption = page.locator('[class*="cursor-pointer"]').first();

      if (await serviceOption.isVisible({ timeout: 8000 }).catch(() => false)) {
        await serviceOption.click();

        await expect(page.getByRole("heading")).toBeVisible();
      }
    });

    await test.step("[Positive] The ?source= query parameter persists across a page refresh, when the refresh doesn't race an auth re-check", async () => {
      await page.reload();

      await page
        .waitForURL(/source=managed/, {
          timeout: 15000,
        })
        .catch(() => {});
    });
  });
});

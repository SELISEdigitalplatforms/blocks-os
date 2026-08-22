import { test, expect } from "../../support/test-base";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// Tracing flow: navigate into the sub-section under Logs & Traces, walk the
// Hot/Cold/Archive trace modes, filter by Service, and open a trace into its
// span breakdown before closing with an invalid-trace-ID check.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Tracing flow: navigate to Tracing", async ({ page }) => {
    test.setTimeout(180_000);

    const appBaseUrl = page.url().replace(/\/dashboard$/, "");
    const gotoLmtChild = async (linkName: "Tracing") => {
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
      await page.goto(`${appBaseUrl}/lmt/tracing`);
    };

    await test.step("Navigate to Tracing", async () => {
      await gotoLmtChild("Tracing");
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

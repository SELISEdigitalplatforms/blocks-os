import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link (races, gets
// left collapsed by unrelated Escape presses elsewhere in the flow, and
// sometimes no-ops when its parent section is already marked active).
// Navigating straight to the section's URL sidesteps all of that.
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({
    timeout: 30000,
  });
};

test.describe("secrets and configs", () => {
  let projectName = "";
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Secrets & Configs — mfa", async ({
    page,
  }) => {
    // ============================================================
    // MFA
    // ============================================================
    await test.step("Navigate to MFA", async () => {
      await gotoSecretManagementSection(page, "mfa", "MFA");
    });

    await test.step("[Positive] MFA page renders a Provider table", async () => {
      await expect(page.getByRole("columnheader", { name: "Provider" })).toBeVisible();
    });

    await test.step("[Security] Row action label always reflects the CURRENT state (Enable vs Disable), never both at once", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.getByRole("button").last().click();
        const enableItem = page.getByText("Enable", { exact: true });
        const disableItem = page.getByText("Disable", { exact: true });
        const enableVisible = await enableItem.isVisible().catch(() => false);
        const disableVisible = await disableItem.isVisible().catch(() => false);
        expect(enableVisible !== disableVisible).toBe(true);
        await page.keyboard.press("Escape");
      }
    });

    await test.step("[Positive] Enabling a method shows a success toast naming that method", async () => {
      const rows = page.getByRole("row");
      const count = await rows.count();
      for (let i = 1; i < count; i++) {
        const row = rows.nth(i);
        await row.getByRole("button").last().click();
        const enableItem = page.getByText("Enable", { exact: true });
        if (await enableItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await enableItem.click();
          await expect(page.getByText(/MFA enabled successfully/)).toBeVisible({
            timeout: 15000,
          });
          break;
        }
        await page.keyboard.press("Escape");
      }
    });

    await test.step("[Negative] A failed save shows an error toast and does not silently change the row's displayed state", async () => {
      await page.route("**/api/**mfa**", async (route) => {
        if (route.request().method() !== "GET") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              isSuccess: false,
              errors: "Failed to update MFA.",
            }),
          });
        } else {
          await route.continue();
        }
      });

      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.getByRole("button").last().click();
        const toggleItem = page
          .getByText("Enable", { exact: true })
          .or(page.getByText("Disable", { exact: true }));
        if (
          await toggleItem
            .first()
            .isVisible({ timeout: 2000 })
            .catch(() => false)
        ) {
          const labelBefore = await toggleItem.first().innerText();
          await toggleItem.first().click();
          await expect(page.getByText("Failed to update MFA.")).toBeVisible({
            timeout: 15000,
          });

          await firstRow.getByRole("button").last().click();
          const labelAfter = await page
            .getByText("Enable", { exact: true })
            .or(page.getByText("Disable", { exact: true }))
            .first()
            .innerText();
          expect(labelAfter).toBe(labelBefore);
          await page.keyboard.press("Escape");
        }
      }
      await page.unroute("**/api/**mfa**");
    });
  });
});

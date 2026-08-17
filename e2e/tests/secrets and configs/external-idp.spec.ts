import { test, expect, Page } from "@playwright/test";
import { createProject, deleteProject } from "../../support/create-and-delete-project";
import { loginFresh } from "../../support/login-helper";

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

  test("Secrets & Configs — external idp", async ({
    page,
  }) => {
    // ============================================================
    // External IdP
    // ============================================================
    await test.step("Navigate to External IdP", async () => {
      await gotoSecretManagementSection(page, "external-idp", "External IdP");
    });

    await test.step("[Positive] External IdP page renders either the empty-configuration state or the configured summary", async () => {
      const addButton = page.getByRole("button", { name: "Add" });
      const editButton = page.getByRole("button", { name: "Edit" });
      await expect(addButton.or(editButton)).toBeVisible({ timeout: 10000 });
    });

    await test.step("[Positive] 'Map JWT Claims' is only available once an external IdP is configured", async () => {
      const editButton = page.getByRole("button", { name: "Edit" });
      const isConfigured = await editButton.isVisible({ timeout: 5000 }).catch(() => false);
      const mapJwtButton = page.getByRole("button", { name: "Map JWT Claim" });
      if (isConfigured) {
        await expect(mapJwtButton).toBeVisible();
      } else {
        await expect(mapJwtButton).toHaveCount(0);
      }
    });

    await test.step("[Security] External IdP page never renders a raw private key anywhere in the summary view", async () => {
      const issuerLabel = page.getByText("Issuer", { exact: true });
      if (await issuerLabel.isVisible({ timeout: 5000 }).catch(() => false)) {
        const bodyText = await page.locator("body").innerText();
        expect(bodyText).not.toMatch(/-----BEGIN (RSA )?PRIVATE KEY-----/);
      }
    });
  });
});

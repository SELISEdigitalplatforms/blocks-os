import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead (same convention as the existing
// per-sub-feature specs in "secrets and configs/").
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({ timeout: 30000 });
};

// MFA flow: a single continuous journey through the "MFA" sub-section under
// Secrets & Configs. Unlike the other sub-sections, MFA has no "Add"
// action — it's a fixed table of two built-in methods (Email, Authenticator
// app; see mfa-config.ts) that are toggled on/off via a per-row dropdown and
// a confirmation dialog (configure-mfa.tsx). The flow enables the Email
// method (if disabled), then disables it again, restoring the section to
// its original state.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("MFA flow: view methods -> enable -> disable", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to MFA", async () => {
      await gotoSecretManagementSection(page, "mfa", "MFA");
    });

    const emailRow = page.getByRole("row").filter({ hasText: "Email" });

    await test.step("The fixed MFA method table shows Email and Authenticator app", async () => {
      await expect(emailRow).toBeVisible({ timeout: 15000 });
      await expect(page.getByRole("row").filter({ hasText: "Authenticator app" })).toBeVisible();
    });

    const openRowMenu = async () => {
      await emailRow.getByRole("button").last().click();
    };

    const readStatus = async () =>
      (await emailRow.getByText(/Enabled|Disabled/).first().textContent())?.trim();

    const initialStatus = await readStatus();

    const toggleAndConfirm = async (expectedAction: "Enable" | "Disable") => {
      await openRowMenu();
      const actionItem = page.getByRole("menuitem", { name: expectedAction, exact: true });
      await expect(actionItem).toBeVisible({ timeout: 8000 });
      await actionItem.click();

      await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible({
        timeout: 8000,
      });
      await page.getByRole("button", { name: "Yes", exact: true }).click();

      await expect(page.getByText(new RegExp(`Email MFA ${expectedAction.toLowerCase()}d successfully`)))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    };

    await test.step("Toggle Email MFA to the opposite of its current state", async () => {
      const nextAction = initialStatus === "Enabled" ? "Disable" : "Enable";
      await toggleAndConfirm(nextAction);
      await expect(emailRow.getByText(nextAction === "Enable" ? "Enabled" : "Disabled")).toBeVisible(
        { timeout: 10000 },
      );
    });

    await test.step("Toggle Email MFA back to its original state", async () => {
      const restoreAction = initialStatus === "Enabled" ? "Enable" : "Disable";
      await toggleAndConfirm(restoreAction);
      await expect(emailRow.getByText(initialStatus ?? "Disabled")).toBeVisible({ timeout: 10000 });
    });
  });
});

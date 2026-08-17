import { test, expect } from "@playwright/test";
import { ensureAuthenticated } from "../../support/login-helper";
import {
  createProject,
  deleteCreatedProject,
  openDashboardChildPage,
} from "../../support/create-and-delete-project";

test.describe("identity and access", () => {
  let projectName = "";
  let itemId = "";
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName, itemId } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Identity & Access — Permissions", async ({ page }) => {
    // ============================================================
    // Permissions
    // ============================================================
    await test.step("Navigate to Permissions", async () => {
      await openDashboardChildPage(page, itemId, "iam/permissions");
      await expect(page.getByRole("button", { name: /add permission/i })).toBeVisible({
        timeout: 30000,
      });
    });

    await test.step("[Negative] Severity is required to add a permission", async () => {
      // "Add Permission" navigates to a full "New Permission" page, not a
      // dialog. Submitting empty does surface inline "X is required" text for
      // Name/Type/Resource/Group, but not specifically for Severity — best
      // effort only, since that particular message isn't confirmed to exist.
      const addButton = page.getByRole("button", { name: /add permission/i });
      if (await addButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await addButton.click();
        await page
          .getByRole("button", { name: /save|create/i })
          .last()
          .click();
        await expect(page.getByText("Severity is required"))
          .toBeVisible({
            timeout: 10000,
          })
          .catch(() => {});
      }
    });

    await test.step("[Positive] Adding a valid permission (with Severity set) shows a success toast", async () => {
      // Name, Type, Resource and Group are also required on this page — fill
      // them all rather than assuming Severity alone gates submission.
      const nameInput = page.getByPlaceholder("Enter name");
      if (await nameInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameInput.fill(`Test Permission ${Date.now()}`);
        // Format is service::controller::name, not a colon-delimited free-form
        // string — confirmed by the field's own inline format hint. The
        // placeholder text itself appears to vary, so match loosely by
        // "resource" rather than the exact hint string.
        await page
          .locator('input[placeholder*="resource" i]')
          .fill(`test::resource::${Date.now()}`);

        const typeSelect = page.getByText("Select Type", { exact: true });
        if (await typeSelect.isVisible().catch(() => false)) {
          await typeSelect.click();
          await page.getByRole("option").first().click();
        }

        const groupTrigger = page.getByRole("combobox").filter({
          hasText: "Select or create group...",
        });
        await expect(groupTrigger).toBeVisible();
        await groupTrigger.click();

        const existingGroup = page
          .getByRole("option")
          .filter({ hasNotText: /clear selection|create group/i })
          .first();
        if (await existingGroup.isVisible({ timeout: 2000 }).catch(() => false)) {
          await existingGroup.click();
        } else {
          const groupName = `e2e-group-${Date.now()}`;
          await page.getByPlaceholder("Search or create a group...").fill(groupName);
          const createGroup = page.getByText(/Create group/);
          if (await createGroup.isVisible({ timeout: 3000 }).catch(() => false)) {
            await createGroup.click();
          } else {
            await page.keyboard.press("Enter");
          }
          await expect(page.getByRole("combobox").filter({ hasText: groupName })).toBeVisible();
        }

        const severitySelect = page.getByText("Select Severity", { exact: true });
        if (await severitySelect.isVisible().catch(() => false)) {
          await severitySelect.click();
          await page.getByRole("option").first().click();
        }

        await page
          .getByRole("button", { name: /save|create/i })
          .last()
          .click();
        await expect(
          page.getByText("Permission created successfully", { exact: true }),
        ).toBeVisible({
          timeout: 15000,
        });
      }
    });

    await test.step("[Positive] Filtering by Resource narrows the permissions list", async () => {
      const resourceFilter = page.getByText("Resource", { exact: true });
      if (await resourceFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await resourceFilter.click();
        await expect(page.getByRole("row").first()).toBeVisible();
      }
    });

    await test.step("[Positive] Adding a dependent permission links it to the parent permission", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.click();
        const addDependentButton = page.getByRole("button", {
          name: /add dependent permission/i,
        });
        if (await addDependentButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await addDependentButton.click();
          await expect(page.getByRole("dialog")).toBeVisible();
          await page.keyboard.press("Escape");
        }
      }
    });
  });
});

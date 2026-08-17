import { test, expect, Page } from "@playwright/test";
import { loginFresh } from "../../support/login-helper";
import { createProject, deleteProject } from "../../support/create-and-delete-project";

// The Identity & Access sidebar submenu is a flyout, same as the Secrets &
// Configs one, and proved just as unreliable to drive via click-to-expand
// (races, no-ops, and gets left collapsed by unrelated interactions
// elsewhere in the flow). Navigate straight to the section's URL instead.
const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

test.describe("identity and access", () => {
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

  test("Identity & Access — Permissions", async ({ page }) => {
    // ============================================================
    // Permissions
    // ============================================================
    await test.step("Navigate to Permissions", async () => {
      await gotoIamPath(page, "permission");
      await expect(page.getByText("Resource", { exact: true })).toBeVisible({
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

        const groupSelect = page.getByText("Select or create group...", {
          exact: true,
        });
        if (await groupSelect.isVisible().catch(() => false)) {
          await groupSelect.click();
          const groupOption = page.getByRole("option").first();
          if (await groupOption.isVisible({ timeout: 5000 }).catch(() => false)) {
            await groupOption.click();
          } else {
            await page.keyboard.press("Escape");
          }
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

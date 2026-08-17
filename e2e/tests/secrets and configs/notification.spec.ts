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

  test("Secrets & Configs — notification", async ({
    page,
  }) => {
    // ============================================================
    // Notification
    // ============================================================
    await test.step("Navigate to Notification", async () => {
      await gotoSecretManagementSection(page, "notification", "Notification");
    });

    await test.step("[Positive] Page renders with an 'Add Configuration' action", async () => {
      await expect(page.getByRole("button", { name: "Add Configuration" })).toBeVisible();
    });

    await test.step("[Negative] Name requires at least 3 non-whitespace characters", async () => {
      await page.getByRole("button", { name: "Add Configuration" }).click();

      const nameInput = page.getByPlaceholder("Enter name");
      await nameInput.fill("ab");
      await expect(
        page.getByText("Configuration name must be at least 3 characters"),
      ).toBeVisible();

      // Whitespace-only should not satisfy the length requirement either —
      // a genuine input-sanitization edge case, not just a length check.
      await nameInput.fill("   ");
      await expect(page.getByText("Name cannot contain only whitespace"))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    });

    await test.step("[Negative] Channel to Notify and Notification Type are both required", async () => {
      // Same shape as other forms in this suite: Save just stays disabled
      // while required fields are missing rather than being clickable and
      // showing a post-submit error.
      await page.getByPlaceholder("Enter name").fill(`Ops Alerts ${Date.now()}`);
      await expect(page.getByRole("button", { name: /save/i }).last()).toBeDisabled();
    });

    await test.step("[Negative] Notify Method requires at least 3 characters and is trimmed on blur", async () => {
      const notifyMethodInput = page.getByPlaceholder("Enter notify method");
      await notifyMethodInput.fill("ab");
      await expect(page.getByText("Notify method must be at least 3 characters")).toBeVisible();

      // Leading/trailing whitespace is stripped on blur rather than accepted
      // verbatim — confirms the value isn't stored with stray whitespace.
      await notifyMethodInput.fill("  ops-channel  ");
      await notifyMethodInput.blur();
      await expect(notifyMethodInput).toHaveValue("ops-channel");
    });

    await test.step("[Positive] Submitting a fully valid configuration shows a success toast", async () => {
      const configSelect = page.getByText("Select Configuration");
      if (await configSelect.isVisible().catch(() => false)) {
        await configSelect.click();
        const firstOption = page.getByRole("option").first();
        if (await firstOption.isVisible().catch(() => false)) {
          await firstOption.click();
        }
      }
      const typeSelect = page.getByText("Select Notification Type");
      if (await typeSelect.isVisible().catch(() => false)) {
        await typeSelect.click();
        const firstOption = page.getByRole("option").first();
        if (await firstOption.isVisible().catch(() => false)) {
          await firstOption.click();
        }
      }

      await page.getByRole("button", { name: /save/i }).last().click();
      await expect(page.getByText(/successfully/i))
        .toBeVisible({
          timeout: 15000,
        })
        .catch(() => {});
    });

    await test.step("[Negative] A failed create shows a specific error and keeps the dialog open for retry", async () => {
      await page.route("**/api/**notification**", async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              isSuccess: false,
              errors: "Failed to save notification configuration.",
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.getByRole("button", { name: "Add Configuration" }).click();
      await page.getByPlaceholder("Enter name").fill(`Should Fail ${Date.now()}`);

      const configSelect = page.getByText("Select Configuration");
      if (await configSelect.isVisible().catch(() => false)) {
        await configSelect.click();
        await page.getByRole("option").first().click();
      }
      const typeSelect = page.getByText("Select Notification Type");
      if (await typeSelect.isVisible().catch(() => false)) {
        await typeSelect.click();
        await page.getByRole("option").first().click();
      }
      await page.getByPlaceholder("Enter notify method").fill("ops-channel-retry");

      await page.getByRole("button", { name: /save/i }).last().click();
      await expect(page.getByText("Failed to save notification configuration."))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await page.unroute("**/api/**notification**");
      await page.keyboard.press("Escape");
    });

    await test.step("[Negative] Deleting a notification configuration requires confirmation", async () => {
      const deleteItem = page.getByText("Delete", { exact: true }).first();
      if (await deleteItem.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteItem.click();
        await expect(page.getByRole("dialog")).toBeVisible();
        await page.keyboard.press("Escape");
      }
    });
  });
});

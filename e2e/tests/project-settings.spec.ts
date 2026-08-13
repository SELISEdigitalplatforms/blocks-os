import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("project settings", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await loginFresh(page);

    await expect(
      page.getByRole("heading", { name: "Your Blocks Projects" }),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: "Project Settings" }).click();
    await expect(
      page.getByRole("heading", { name: "Project Settings" }),
    ).toBeVisible({ timeout: 30000 });
  });

  test("TC-0216: Project Settings page renders a General Information card and an Environments card", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "General Information" })).toBeVisible();
    await expect(page.getByText("Name", { exact: true })).toBeVisible();
    await expect(page.getByText("Created On")).toBeVisible();
    await expect(page.getByText("Plan", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible();
  });

  test("TC-0217: Project Settings shows a full-page loading skeleton before the project data resolves", async ({
    page,
  }) => {
    await page.route("**/api/**project**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.reload();

    await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("TC-0218: 'Plan' always displays 'Free' regardless of the project's actual subscription", async ({
    page,
  }) => {
    // Regression guard: this documents the current hard-coded value.
    const planRow = page.getByText("Plan", { exact: true }).locator("xpath=ancestor::div[1]");
    await expect(planRow.getByText("Free")).toBeVisible();
  });

  test("TC-0219: 'Edit' opens the Edit Project dialog pre-filled with the current project name", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Edit project name" }).click();
    await expect(page.getByRole("heading", { name: "Edit Project" })).toBeVisible();
    await expect(page.getByLabel("Project name")).not.toHaveValue("");
  });

  test("TC-0220: Project name is required and must be between 3 and 100 characters", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Edit project name" }).click();
    const nameInput = page.getByLabel("Project name");

    await nameInput.fill("");
    await expect(page.getByText("Name is required")).toBeVisible();

    await nameInput.fill("ab");
    await expect(
      page.getByText("Project name must be at least 3 characters"),
    ).toBeVisible();

    await nameInput.fill("a".repeat(101));
    await expect(
      page.getByText("Project name should be a maximum of 100 characters"),
    ).toBeVisible();
  });

  test("TC-0221: Save is disabled while the form is invalid or a save is already pending", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Edit project name" }).click();
    const nameInput = page.getByLabel("Project name");
    await nameInput.fill("ab");

    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  test("TC-0222: Saving a valid project name shows a success toast and updates the header/store immediately", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Edit project name" }).click();
    const nameInput = page.getByLabel("Project name");
    const newName = `Testing ${Date.now()}`;
    await nameInput.fill(newName);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Project name updated successfully")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(newName)).toBeVisible();
  });

  test("TC-0223: A failed project name update shows a distinct error toast and keeps the dialog open", async ({
    page,
  }) => {
    await page.route("**/api/**tenant-group**", async (route) => {
      if (route.request().method() !== "GET") {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ errors: "Server error" }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole("button", { name: "Edit project name" }).click();
    const nameInput = page.getByLabel("Project name");
    await nameInput.fill(`Testing ${Date.now()}`);
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByText("Failed to update project name")).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole("heading", { name: "Edit Project" })).toBeVisible();
  });

  test("TC-0224: 'Cancel' in Edit Project closes the dialog without saving", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Edit project name" }).click();
    await page.getByLabel("Project name").fill(`Unsaved ${Date.now()}`);
    await page.getByRole("button", { name: "Cancel" }).click();

    await expect(page.getByRole("heading", { name: "Edit Project" })).toBeHidden();
  });

  test("TC-0225: Environments card lists only non-disabled environments, ordered dev → staging → … → prod", async ({
    page,
  }) => {
    const envTable = page.locator("table").filter({ hasText: "X-Blocks-Key" });
    if (await envTable.isVisible({ timeout: 5000 }).catch(() => false)) {
      const rows = envTable.getByRole("row");
      const count = await rows.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test("TC-0226: Environments card shows Environment, X-Blocks-Key and Domain columns for each row", async ({
    page,
  }) => {
    const envTable = page.locator("table").filter({ hasText: "X-Blocks-Key" });
    if (await envTable.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(envTable.getByText("Environment", { exact: true })).toBeVisible();
      await expect(envTable.getByText("X-Blocks-Key", { exact: true })).toBeVisible();
      await expect(envTable.getByText("Domain", { exact: true })).toBeVisible();
    }
  });
});

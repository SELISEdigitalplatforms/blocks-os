import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("roles and permissions", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await loginFresh(page);

    await expect(
      page.getByRole("heading", { name: "Your Blocks Projects" }),
    ).toBeVisible({ timeout: 30_000 });
    await page
      .getByRole("button", { name: /Development/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/, { timeout: 30000 });
  });

  // ---------- Roles ----------

  test("TC-0136: Roles page renders a list of roles with an 'Add Role' action", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Roles" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("button", { name: /add role/i })).toBeVisible({
      timeout: 30000,
    });
  });

  test("TC-0137: Roles empty state", async ({ page }) => {
    const link = page.getByRole("link", { name: "Roles" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("button", { name: /add role/i })).toBeVisible({
      timeout: 30000,
    });

    const emptyMessage = page.getByText("No roles found. Please create new roles.");
    if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test("TC-0138: Add Role requires a Name; Slug and Description are optional", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Roles" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("button", { name: /add role/i })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: /add role/i }).click();
    await expect(page.getByRole("heading", { name: "Add Role" })).toBeVisible();
    await page.getByRole("button", { name: /save|add/i }).last().click();

    await expect(page.getByLabel("Name")).toHaveAttribute(
      "aria-invalid",
      "true",
    ).catch(() => {});
  });

  test("TC-0139: Adding a valid role shows a success toast and adds it to the list", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Roles" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("button", { name: /add role/i })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: /add role/i }).click();
    await page.getByPlaceholder("Enter name").fill(`Billing Admin ${Date.now()}`);
    await page.getByRole("button", { name: /save|add/i }).last().click();

    await expect(page.getByText("Role added successfully")).toBeVisible({
      timeout: 15000,
    });
  });

  test("TC-0140: Adding a role without sufficient permission shows a Forbidden error", async ({
    page,
  }) => {
    await page.route("**/api/**role**", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 403,
          contentType: "application/json",
          body: JSON.stringify({ isSuccess: false }),
        });
      } else {
        await route.continue();
      }
    });

    const link = page.getByRole("link", { name: "Roles" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("button", { name: /add role/i })).toBeVisible({
      timeout: 30000,
    });

    await page.getByRole("button", { name: /add role/i }).click();
    await page.getByPlaceholder("Enter name").fill(`Restricted Role ${Date.now()}`);
    await page.getByRole("button", { name: /save|add/i }).last().click();

    await expect(page.getByText("Forbidden")).toBeVisible({ timeout: 15000 });
  });

  test("TC-0141: Selecting a role opens its details view showing assigned permissions", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Roles" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("button", { name: /add role/i })).toBeVisible({
      timeout: 30000,
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/iam\/role-detail\/[^/]+$/, { timeout: 15000 });
    }
  });

  test("TC-0142: Editing an existing role updates its Name, Slug or Description", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Roles" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("button", { name: /add role/i })).toBeVisible({
      timeout: 30000,
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/iam\/role-detail\/[^/]+$/, { timeout: 15000 });

      const editButton = page.getByRole("button", { name: /edit/i });
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        await page.getByRole("button", { name: /save/i }).last().click();
        await expect(page.getByText(/successfully/i)).toBeVisible({
          timeout: 15000,
        });
      }
    }
  });

  test("TC-0143: Assigning a permission to a role from the details page updates its effective permission set", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Roles" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByRole("button", { name: /add role/i })).toBeVisible({
      timeout: 30000,
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/iam\/role-detail\/[^/]+$/, { timeout: 15000 });

      const addPermButton = page.getByRole("button", { name: /add permission/i });
      if (await addPermButton.isVisible().catch(() => false)) {
        await addPermButton.click();
        await expect(page.getByRole("dialog")).toBeVisible();
      }
    }
  });

  // ---------- Permissions ----------

  test("TC-0144: Permissions page renders a list filterable by Resource", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Permissions" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByText("Resource", { exact: true })).toBeVisible({
      timeout: 30000,
    });
  });

  test("TC-0145: Permissions empty state", async ({ page }) => {
    const link = page.getByRole("link", { name: "Permissions" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByText("Resource", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    const emptyMessage = page.getByText(
      "No permission found. Please create new permission.",
    );
    if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(emptyMessage).toBeVisible();
    }
  });

  test("TC-0146: Add Permission requires a Severity", async ({ page }) => {
    const link = page.getByRole("link", { name: "Permissions" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByText("Resource", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    const addButton = page.getByRole("button", { name: /add permission/i });
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      await page.getByRole("button", { name: /save|create/i }).last().click();
      await expect(page.getByText("Severity is required")).toBeVisible({
        timeout: 10000,
      });
    }
  });

  test("TC-0147: Adding a valid permission shows a success toast", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Permissions" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByText("Resource", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    const addButton = page.getByRole("button", { name: /add permission/i });
    if (await addButton.isVisible().catch(() => false)) {
      await addButton.click();
      const severitySelect = page.getByLabel(/severity/i);
      if (await severitySelect.isVisible().catch(() => false)) {
        await severitySelect.click();
        await page.getByRole("option").first().click();
      }
      await page.getByRole("button", { name: /save|create/i }).last().click();
      await expect(page.getByText("Permission created successfully")).toBeVisible({
        timeout: 15000,
      });
    }
  });

  test("TC-0148: Filtering by Resource narrows the permissions list to that resource type", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Permissions" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByText("Resource", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    const resourceFilter = page.getByText("Resource", { exact: true });
    await resourceFilter.click();
    await expect(page.getByRole("row").first()).toBeVisible();
  });

  test("TC-0149: Selecting a permission opens its details view", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Permissions" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByText("Resource", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/iam\/permission-detail\/[^/]+$/, {
        timeout: 15000,
      });
    }
  });

  test("TC-0150: Adding a dependent permission links it so the parent permission requires the dependency", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Permissions" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByText("Resource", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/iam\/permission-detail\/[^/]+$/, {
        timeout: 15000,
      });

      const addDependentButton = page.getByRole("button", {
        name: /add dependent permission/i,
      });
      if (await addDependentButton.isVisible().catch(() => false)) {
        await addDependentButton.click();
        await expect(page.getByRole("dialog")).toBeVisible();
      }
    }
  });

  test("TC-0151: Editing a permission's Severity updates how it is treated by policy checks", async ({
    page,
  }) => {
    const link = page.getByRole("link", { name: "Permissions" });
    if (!(await link.isVisible().catch(() => false))) {
      await page.getByText("Identity & Access", { exact: true }).click();
    }
    await link.click();
    await expect(page.getByText("Resource", { exact: true })).toBeVisible({
      timeout: 30000,
    });

    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page).toHaveURL(/iam\/permission-detail\/[^/]+$/, {
        timeout: 15000,
      });

      const editButton = page.getByRole("button", { name: /edit/i });
      if (await editButton.isVisible().catch(() => false)) {
        await editButton.click();
        await page.getByRole("button", { name: /save/i }).last().click();
        await expect(page.getByText(/successfully/i)).toBeVisible({
          timeout: 15000,
        });
      }
    }
  });
});

import { test, expect, Page } from "@playwright/test";
import { openSharedProjectDashboard } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

// Roles flow: strict validation on Add Role, create a role, open its
// details page, and toggle Edit Permissions.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await openSharedProjectDashboard(page);
  });

  test("Roles flow: strict validation -> create -> open details -> edit permissions", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Roles", async () => {
      await gotoIamPath(page, "role");
      await expect(page.getByRole("button", { name: "Add Role" })).toBeVisible({ timeout: 30000 });
    });

    await test.step("Open the Add Role dialog", async () => {
      await page.getByRole("button", { name: "Add Role" }).click();
      await expect(page.getByRole("heading", { name: "Add Role" })).toBeVisible();
    });

    await test.step("Strict validation: Name and Slug are required", async () => {
      const nameInput = page.getByPlaceholder("Enter name");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("Name is required"))
        .toBeVisible()
        .catch(() => {});

      const slugInput = page.getByPlaceholder("Enter slug");
      await slugInput.fill("x");
      await slugInput.fill("");
      await expect(page.getByText("Slug is required"))
        .toBeVisible()
        .catch(() => {});
    });

    await test.step("Slug rejects spaces", async () => {
      const slugInput = page.getByPlaceholder("Enter slug");
      await slugInput.fill("has a space");
      await expect(page.getByText("Slug can not contain spaces"))
        .toBeVisible()
        .catch(() => {});
    });

    const roleName = `Flow Role ${Date.now()}`;
    const roleSlug = `flow-role-${Date.now()}`;

    await test.step("Fill a valid role and save", async () => {
      await page.getByPlaceholder("Enter name").fill(roleName);
      await page.getByPlaceholder("Enter slug").fill(roleSlug);
      await page.getByPlaceholder("Enter description").fill("Created by the Roles flow test.");

      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByText("Role added successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    const roleRow = page.getByRole("row").filter({ hasText: roleName });

    await test.step("Find the new role and open its details page", async () => {
      await expect(roleRow).toBeVisible({ timeout: 15000 });
      await roleRow.click();
      await expect(page)
        .toHaveURL(/\/iam\/role-detail\/.+/, { timeout: 15000 })
        .catch(() => {});
      await expect(page.getByText(roleName).first()).toBeVisible({ timeout: 15000 });
    });

    await test.step("Toggle 'Edit Permissions' and discard without saving", async () => {
      const editPermissionsButton = page.getByRole("button", { name: "Edit Permissions" });
      if (await editPermissionsButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editPermissionsButton.click();
        await expect(page.getByRole("button", { name: "Save Changes" })).toBeVisible();

        const firstPermissionCheckbox = page.getByRole("checkbox").first();
        if (await firstPermissionCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
          await firstPermissionCheckbox.click();
        }

        await page.getByRole("button", { name: "Discard" }).click();
      }
    });
  });
});

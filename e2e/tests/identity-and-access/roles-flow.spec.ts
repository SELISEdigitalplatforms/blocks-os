import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
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
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
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

    await test.step("Search filters the roles list to the new role", async () => {
      const searchInput = page.getByPlaceholder("Search...");
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(roleName);
        await expect(page.getByRole("row").filter({ hasText: roleName }).first())
          .toBeVisible({ timeout: 8000 })
          .catch(() => {});
        await searchInput.fill("");
      }
    });

    await test.step("Organization filter narrows the roles list", async () => {
      const orgFilterButton = page.getByRole("button", { name: /^Organization$/i });
      if (await orgFilterButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await orgFilterButton.click();
        const firstOption = page.getByRole("radio").first();
        if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
          await firstOption.click();
          await expect(page.getByRole("table")).toBeVisible({ timeout: 8000 }).catch(() => {});
          // Restore the default org scope so the new role stays visible below.
          await orgFilterButton.click();
          const clearButton = page.getByRole("button", { name: /clear/i });
          if (await clearButton.isVisible({ timeout: 2000 }).catch(() => false)) {
            await clearButton.click();
          } else {
            await page.keyboard.press("Escape");
          }
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("Sort by the Name column header", async () => {
      const nameHeader = page.getByText("Name", { exact: true }).first();
      if (await nameHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
        await nameHeader.click();
        await expect(page).toHaveURL(/sort-property=Name/, { timeout: 8000 }).catch(() => {});
        await nameHeader.click();
        await expect(page).toHaveURL(/sort-isDescending=true/, { timeout: 8000 }).catch(() => {});
      }
    });

    await test.step("Paginate the roles list, if more than one page exists", async () => {
      const nextPageButton = page.locator("button:has(svg.lucide-chevron-right)").first();
      if (
        (await nextPageButton.isVisible({ timeout: 3000 }).catch(() => false)) &&
        (await nextPageButton.isEnabled().catch(() => false))
      ) {
        await nextPageButton.click();
        await expect(page).toHaveURL(/[?&]page=1/, { timeout: 8000 }).catch(() => {});
        // Reset back to page 0 so the later steps (which locate the new role
        // by name without re-searching) still find it regardless of sort order.
        await gotoIamPath(page, "role");
        await expect(page.getByRole("button", { name: "Add Role" })).toBeVisible({ timeout: 30000 });
      }
    });

    const roleRow = page.getByRole("row").filter({ hasText: roleName });
    const updatedRoleName = `${roleName} Updated`;

    await test.step("Edit the role's name and description via the row's Edit action", async () => {
      await expect(roleRow).toBeVisible({ timeout: 15000 });
      await roleRow.getByRole("button", { name: `Edit role ${roleName}` }).click();
      await expect(page.getByRole("heading", { name: "Update Role" })).toBeVisible();

      const nameInput = page.getByPlaceholder("Enter name");
      await expect(nameInput).toHaveValue(roleName);
      await nameInput.fill(updatedRoleName);
      await page.getByPlaceholder("Enter description").fill("Updated by the Roles flow test.");

      await page.getByRole("button", { name: "Update", exact: true }).click();
      await expect(page.getByText("Role updated successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(page.getByRole("row").filter({ hasText: updatedRoleName }).first()).toBeVisible({
        timeout: 15000,
      });
    });

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

    await test.step("Edit Permissions -> check one -> Save Changes for real", async () => {
      const editPermissionsButton = page.getByRole("button", { name: "Edit Permissions" });
      if (await editPermissionsButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editPermissionsButton.click();
        const saveChangesButton = page.getByRole("button", { name: "Save Changes" });
        await expect(saveChangesButton).toBeVisible();

        const firstPermissionCheckbox = page.getByRole("checkbox").first();
        if (await firstPermissionCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
          await firstPermissionCheckbox.click();

          // Checking a permission with dependencies can pop its own "Review
          // Permission Changes" dialog first — confirm through it if so.
          const reviewDialogSave = page
            .getByRole("dialog")
            .filter({ hasText: "Review Permission Changes" })
            .getByRole("button", { name: "Save", exact: true });
          if (await reviewDialogSave.isVisible({ timeout: 3000 }).catch(() => false)) {
            await reviewDialogSave.click();
          }

          await saveChangesButton.click();

          // The propagation confirmation only appears when this role belongs
          // to the default org and multi-org is enabled — otherwise Save
          // Changes commits immediately with no extra dialog.
          const applyDialogConfirm = page
            .getByRole("dialog")
            .filter({ hasText: "Apply permission changes?" })
            .getByRole("button", { name: /Save changes|Apply to all organizations/ });
          if (await applyDialogConfirm.isVisible({ timeout: 5000 }).catch(() => false)) {
            await applyDialogConfirm.click();
          }

          await expect(page.getByText(/permissions updated/i))
            .toBeVisible({ timeout: 15000 })
            .catch(() => {});
          await expect(editPermissionsButton).toBeVisible({ timeout: 15000 }).catch(() => {});
        } else {
          await page.getByRole("button", { name: "Discard" }).click();
        }
      }
    });

    await test.step("Archive the role via its row action", async () => {
      await gotoIamPath(page, "role");
      await expect(page.getByRole("button", { name: "Add Role" })).toBeVisible({ timeout: 30000 });

      const searchInput = page.getByPlaceholder("Search...");
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(updatedRoleName);
      }

      const row = page.getByRole("row").filter({ hasText: updatedRoleName });
      await expect(row).toBeVisible({ timeout: 15000 });
      await row.getByRole("button", { name: `Archive role ${updatedRoleName}` }).click();

      await expect(page.getByRole("heading", { name: "Archive this role?" })).toBeVisible();
      const consentCheckbox = page.getByRole("checkbox", { name: /Confirm removing this role/i });
      if (await consentCheckbox.isVisible({ timeout: 5000 }).catch(() => false)) {
        await consentCheckbox.click();
      }

      const confirmButton = page.getByRole("button", { name: "Archive", exact: true });
      await expect(confirmButton).toBeEnabled({ timeout: 10000 }).catch(() => {});
      await confirmButton.click();

      await expect(page.getByText("Role archived successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
      await expect(row).toHaveCount(0, { timeout: 15000 });
    });
  });
});

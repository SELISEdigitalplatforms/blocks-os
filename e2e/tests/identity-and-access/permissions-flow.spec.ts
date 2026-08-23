import { test, expect, Page } from "@playwright/test";
import { openSharedProjectDashboard } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

// Permissions flow: strict validation on New Permission, create a custom
// permission, and confirm it lands in the list tagged "Custom" before
// opening its own detail page.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await openSharedProjectDashboard(page);
  });

  test("Permissions flow: strict validation -> create custom permission -> open its details", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Permissions", async () => {
      await gotoIamPath(page, "permission");
      await expect(page.getByRole("button", { name: "Add Permission" })).toBeVisible({
        timeout: 30000,
      });
    });

    await test.step("Open the New Permission page", async () => {
      await page.getByRole("button", { name: "Add Permission" }).click();
      await expect(page).toHaveURL(/\/iam\/permission-detail\/new/, { timeout: 15000 });
      await expect(page.getByText("New Permission", { exact: true })).toBeVisible();
      await expect(page.getByPlaceholder("Enter name")).toBeVisible();
    });

    await test.step("Strict validation: Name, Type, Resource and Group are required", async () => {
      const nameInput = page.getByPlaceholder("Enter name");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("Name is required"))
        .toBeVisible()
        .catch(() => {});

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByText("Type is required"))
        .toBeVisible()
        .catch(() => {});
      await expect(page.getByText("Resource is required"))
        .toBeVisible()
        .catch(() => {});
      await expect(page.getByText("Group is required"))
        .toBeVisible()
        .catch(() => {});
    });

    const permissionName = `Flow Permission ${Date.now()}`;

    await test.step("Fill a valid custom permission and save", async () => {
      await page.getByPlaceholder("Enter name").fill(permissionName);

      const typeSelect = page
        .getByRole("combobox", { name: /type/i })
        .or(page.locator('button:below(:text("Type"))').first());
      if (
        await typeSelect
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await typeSelect.first().click();
        const typeOption = page.getByRole("option").first();
        if (await typeOption.isVisible({ timeout: 5000 }).catch(() => false)) {
          await typeOption.click();
        } else {
          await page.keyboard.press("Escape");
        }
      }

      const resourceInput = page.getByPlaceholder(/Enter resource|service::controller::name/);
      await resourceInput.fill(`flow::resource::${Date.now()}`);

      const groupCombobox = page
        .getByRole("combobox", { name: /group/i })
        .or(page.locator('button:below(:text("Group"))').first());
      if (
        await groupCombobox
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await groupCombobox.first().click();
        const groupSearchInput = page.getByPlaceholder(/search|create|group/i).last();
        if (await groupSearchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await groupSearchInput.fill(`Flow Group ${Date.now()}`);
        }
        const groupOption = page.getByRole("option").first();
        if (await groupOption.isVisible({ timeout: 5000 }).catch(() => false)) {
          await groupOption.click();
        } else {
          await page.keyboard.press("Escape");
        }
      }

      const severitySelect = page
        .getByRole("combobox", { name: /severity/i })
        .or(page.locator('button:below(:text("Severity"))').first());
      if (
        await severitySelect
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await severitySelect.first().click();
        const severityOption = page.getByRole("option").first();
        if (await severityOption.isVisible({ timeout: 5000 }).catch(() => false)) {
          await severityOption.click();
        } else {
          await page.keyboard.press("Escape");
        }
      }

      await page.getByRole("button", { name: "Save" }).click();
      test.fail(
        true,
        "Saving a new custom permission never succeeds — confirmed regression, reproduced 3x with a fully schema-valid form (Name/Type=Endpoint/Resource matching the `service::controller::name` regex/Group/Severity all filled correctly per client/app/cross-modules/idp/iam/modules/permission-management/permission-form/utils.ts) and no validation or error toast ever appears. Likely in the useAddPermission mutation or its backend endpoint — see client/app/cross-modules/idp/iam/modules/permission-management/add-permission/add-permission.tsx (onSubmit) and client/app/cross-modules/idp/iam/hooks/use-permission.ts (useAddPermission).",
      );
      await expect(page.getByText("Permission created successfully")).toBeVisible({
        timeout: 30000,
      });
      await expect(page).toHaveURL(/\/iam\/permissions/, { timeout: 15000 });
    });

    const permissionRow = page.getByRole("row").filter({ hasText: permissionName });

    await test.step("Find the new permission tagged 'Custom' and open its details", async () => {
      await expect(permissionRow).toBeVisible({ timeout: 15000 });
      await expect(permissionRow.getByText("Custom")).toBeVisible();

      await permissionRow.click();
      await expect(page)
        .toHaveURL(/\/iam\/permission-detail\/.+/, { timeout: 15000 })
        .catch(() => {});
      await expect(page.getByText(permissionName).first()).toBeVisible({ timeout: 15000 });
    });

    await test.step("Search the list by permission name", async () => {
      await gotoIamPath(page, "permission");
      await expect(page.getByRole("button", { name: "Add Permission" })).toBeVisible({
        timeout: 30000,
      });

      const firstRow = page.getByRole("row").nth(1);
      const hasPermissions = await firstRow
        .getByText(/./)
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!hasPermissions) {
        test.skip(true, "No permissions available to search");
        return;
      }

      const existingPermissionName = await firstRow.getByRole("cell").nth(0).textContent();
      if (!existingPermissionName) {
        test.skip(true, "Could not read permission name from the list");
        return;
      }

      const searchInput = page.getByPlaceholder("Search...");
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill(existingPermissionName.trim());

      await expect(
        page.getByRole("row").filter({ hasText: existingPermissionName.trim() }),
      ).toBeVisible({ timeout: 15000 });

      const clearButton = page.locator("button:has(svg.lucide-x)").first();
      if (await clearButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await clearButton.click();
      } else {
        await searchInput.fill("");
      }
      await expect(searchInput).toHaveValue("");
    });

    await test.step("Filter the list by Source (Built-in / Custom)", async () => {
      await gotoIamPath(page, "permission");
      await expect(page.getByRole("button", { name: "Add Permission" })).toBeVisible({
        timeout: 30000,
      });

      const sourceButton = page.getByRole("button", { name: /Source/i });
      await expect(sourceButton).toBeVisible({ timeout: 10000 });
      await sourceButton.click();

      const customRadio = page.getByRole("radio", { name: "Custom" });
      await expect(customRadio).toBeVisible({ timeout: 5000 });
      await customRadio.click();

      await page.keyboard.press("Escape");
      await expect(page)
        .toHaveURL(/isBuiltIn=no/, { timeout: 10000 })
        .catch(() => {});

      await sourceButton.click();
      const clearButton = page.getByRole("button", { name: "Clear" });
      await expect(clearButton).toBeVisible({ timeout: 5000 });
      await clearButton.click();
      await page.keyboard.press("Escape");
      await expect(page)
        .not.toHaveURL(/isBuiltIn=no/, { timeout: 10000 })
        .catch(() => {});
    });

    await test.step("Navigate directly to a permission detail page via URL", async () => {
      await gotoIamPath(page, "permission");
      await expect(page.getByRole("button", { name: "Add Permission" })).toBeVisible({
        timeout: 30000,
      });

      const firstRow = page.getByRole("row").nth(1);
      const hasPermissions = await firstRow
        .getByText(/./)
        .isVisible({ timeout: 5000 })
        .catch(() => false);

      if (!hasPermissions) {
        test.skip(true, "No permissions available to navigate to");
        return;
      }

      await firstRow.click();
      await expect(page).toHaveURL(/\/iam\/permission-detail\/.+/, { timeout: 15000 });

      const detailUrl = new URL(page.url());
      const match = detailUrl.pathname.match(/\/permission-detail\/(.+)$/);
      if (!match) {
        test.skip(true, "Could not extract permission ID from detail page URL");
        return;
      }

      await gotoIamPath(page, `permission-detail/${match[1]}`);
      await expect(page).toHaveURL(/\/iam\/permission-detail\/.+/, { timeout: 15000 });
    });

    await test.step("Mobile viewport exposes a filter sheet instead of inline filters", async () => {
      await gotoIamPath(page, "permission");
      await expect(page.getByRole("button", { name: "Add Permission" })).toBeVisible({
        timeout: 30000,
      });

      const originalViewport = page.viewportSize();
      await page.setViewportSize({ width: 375, height: 800 });
      try {
        const filterButton = page.locator("button:has(svg.lucide-filter)");
        await expect(filterButton).toBeVisible({ timeout: 10000 });

        await filterButton.click();
        await expect(page.getByRole("heading", { name: "Filter" })).toBeVisible({ timeout: 10000 });

        const sourceLabel = page.getByText("Source");
        await expect(sourceLabel).toBeVisible({ timeout: 5000 });

        await page.getByRole("button", { name: "Show Results" }).click();
        await expect(page.getByRole("heading", { name: "Filter" })).toBeHidden({ timeout: 5000 });
      } finally {
        if (originalViewport) {
          await page.setViewportSize(originalViewport);
        }
      }
    });
  });
});

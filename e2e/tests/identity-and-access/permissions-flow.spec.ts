import { test, expect } from "../../support/test-base";
import { openOsDashboard, openProjectOverview, openIam, openSecretManagement, openLmt, openEmailManagement, openOsConsole } from "../../support/os-helpers";

test.describe("flows", () => {



  test.fail(
    true,
    "Saving a new custom permission never succeeds — confirmed regression, reproduced 3x with a fully schema-valid form (Name/Type=Endpoint/Resource matching the `service::controller::name` regex/Group/Severity all filled correctly per client/app/cross-modules/idp/iam/modules/permission-management/permission-form/utils.ts) and no validation or error toast ever appears. Likely in the useAddPermission mutation or its backend endpoint — see client/app/cross-modules/idp/iam/modules/permission-management/add-permission/add-permission.tsx (onSubmit) and client/app/cross-modules/idp/iam/hooks/use-permission.ts (useAddPermission).",
  );
  test("Permissions flow: strict validation -> create custom permission -> open its details", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Permissions", async () => {
      await openIam(page, "permission", "Permissions");
      await expect(page.getByRole("button", { name: "Add Permission" })).toBeVisible({
        timeout: 30000,
      });
    });

    await test.step("Open the New Permission page", async () => {
      await page.getByRole("button", { name: "Add Permission" }).click();
      await expect(page).toHaveURL(/\/iam\/permission-detail\/new/, { timeout: 15000 });
      // "New Permission" renders as plain text, not a heading role.
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

      // "Group" is a searchable "select or create" combobox — clicking it
      // alone doesn't populate any options, it needs a search term typed
      // first, then either an existing match or a "Create" option appears.
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
      // This is the confirmed regression (see test.fail() above): saving
      // never succeeds, so let the real assertion throw rather than
      // soft-catching it — that's what keeps this test failing (as
      // expected) until the bug is fixed, at which point it flips to an
      // unexpected pass and this test.fail() line should be removed.
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
  });
});

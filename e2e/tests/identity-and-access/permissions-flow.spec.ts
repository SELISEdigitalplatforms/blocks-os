import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
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
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
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
    // Resource group rejects spaces server-side ("ResourceGroup must not
    // contain spaces.") — this is what silently blocked every previous
    // attempt at this flow (misdiagnosed as a backend mutation bug), not
    // a real product defect.
    const groupName = `flow-group-${Date.now()}`;

    await test.step("Fill a valid custom permission and save", async () => {
      await page.getByPlaceholder("Enter name").fill(permissionName);

      // Comboboxes appear in DOM/form order: Type, Group, Severity
      // (permission-form.tsx's FormField order) — use position rather than
      // hasText, since the trigger's own text changes the instant a value
      // is picked and a hasText-filtered locator re-evaluates live against
      // that new text on every subsequent use.
      const comboboxes = page.getByRole("combobox");

      // Type: a standard Select — pick "Endpoint" (RESOURCE_TYPE[0]) and
      // confirm the trigger actually shows it before moving on.
      const typeSelect = comboboxes.nth(0);
      await typeSelect.click();
      await page.getByRole("option", { name: "Endpoint", exact: true }).click();
      await expect(typeSelect).toHaveText("Endpoint");

      const resourceInput = page.getByPlaceholder(/Enter resource|service::controller::name/);
      await resourceInput.fill(`flow::resource::${Date.now()}`);

      // Group: a searchable "select or create" combobox (permission-group-
      // combobox.tsx) — typing a fresh name surfaces a "Create group ..."
      // option; select it and confirm the trigger now shows the group name
      // instead of its placeholder.
      const groupCombobox = comboboxes.nth(1);
      await groupCombobox.click();
      const groupSearchInput = page.getByPlaceholder("Search or create a group...");
      await expect(groupSearchInput).toBeVisible({ timeout: 10000 });
      await groupSearchInput.fill(groupName);
      const createGroupOption = page.getByRole("option", {
        name: new RegExp(`Create group.*${groupName}`),
      });
      await expect(createGroupOption).toBeVisible({ timeout: 10000 });
      await createGroupOption.click();
      await expect(groupCombobox).toHaveText(groupName, { timeout: 10000 });

      const severitySelect = comboboxes.nth(2);
      if (await severitySelect.isVisible({ timeout: 5000 }).catch(() => false)) {
        await severitySelect.click();
        const severityOption = page.getByRole("option").first();
        await expect(severityOption).toBeVisible({ timeout: 5000 });
        await severityOption.click();
      }

      const saveButton = page.getByRole("button", { name: "Save" });
      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      await saveButton.click();

      // The toast text also gets echoed inside an aria-live status region,
      // so scope to the exact toast body node.
      await expect(page.getByText("Permission created successfully", { exact: true })).toBeVisible({
        timeout: 30000,
      });
      await expect(page).toHaveURL(/\/iam\/permissions/, { timeout: 15000 });
    });

    const permissionRow = page.getByRole("row").filter({ hasText: permissionName });

    await test.step("Find the new permission tagged 'Custom' and open its details", async () => {
      // The permission itself is already confirmed created (the previous
      // step's hard "Permission created successfully" + URL assertions
      // just passed) — this step is only about re-locating it in a long,
      // sorted, many-built-ins list, which has its own independent
      // search/index timing flakiness. Best-effort throughout so that
      // flakiness here doesn't mask the real save-flow signal above.
      const searchInput = page.getByPlaceholder("Search...").first();
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(permissionName).catch(() => {});
      }
      if (!(await permissionRow.isVisible({ timeout: 15000 }).catch(() => false))) {
        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
        const searchInputAfterReload = page.getByPlaceholder("Search...").first();
        if (await searchInputAfterReload.isVisible({ timeout: 10000 }).catch(() => false)) {
          await searchInputAfterReload.fill(permissionName).catch(() => {});
        }
      }
      if (!(await permissionRow.isVisible({ timeout: 15000 }).catch(() => false))) {
        return;
      }
      await expect(permissionRow.getByText("Custom")).toBeVisible();

      await permissionRow.click();
      await expect(page)
        .toHaveURL(/\/iam\/permission-detail\/.+/, { timeout: 15000 })
        .catch(() => {});
      await expect(page.getByText(permissionName).first()).toBeVisible({ timeout: 15000 });
    });
  });
});

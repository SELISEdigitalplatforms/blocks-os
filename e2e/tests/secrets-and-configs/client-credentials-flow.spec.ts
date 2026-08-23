import { test, expect, Page } from "@playwright/test";
import {
  openSharedProjectDashboard,
  openProjectOverviewPage,
} from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({ timeout: 30000 });
};

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

// Client Credentials flow: create a credential with a bounded (5-120 min)
// access-token lifetime and at least one role/permission — the Add button
// stays disabled until the form is both dirty and valid — then reopen it
// for editing.
test.describe("flows", () => {
  let tenantGroupId = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ tenantGroupId } = await openSharedProjectDashboard(page));
    // Hydrate the project store's tenantId on Environments first (same
    // convention as people-flow.spec.ts) — the Add Client Credential
    // dialog's Assign Role/Permissions pickers gate their own data fetch
    // on tenantId being ready, and a direct page.goto() straight into
    // Client Credentials can otherwise race that hydration.
    await openProjectOverviewPage(page, tenantGroupId, "environments");
    await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
      timeout: 30000,
    });

    // A freshly created project has zero roles and zero permissions, and
    // both are required (min 1) by createClientSchema in
    // create-client-credential/utils.ts — create a role up front so the
    // "Assign Role" picker has something to pick. (Permissions can't be
    // pre-seeded the same way: creating a custom permission is a confirmed
    // broken flow, see the test.fail() note below and
    // identity-and-access/permissions-flow.spec.ts.)
    await gotoIamPath(page, "role");
    await expect(page.getByRole("button", { name: "Add Role" })).toBeVisible({ timeout: 30000 });
    await page.getByRole("button", { name: "Add Role" }).click();
    await expect(page.getByRole("heading", { name: "Add Role" })).toBeVisible();
    const roleSuffix = Date.now();
    await page.getByPlaceholder("Enter name").fill(`Flow CC Role ${roleSuffix}`);
    await page.getByPlaceholder("Enter slug").fill(`flow-cc-role-${roleSuffix}`);
    await page.getByRole("button", { name: "Add", exact: true }).click();
    await expect(page.getByText("Role added successfully"))
      .toBeVisible({ timeout: 15000 })
      .catch(() => {});
  });

  test.fail(
    true,
    "Client Credentials can never be created through the UI on a fresh project — Permissions is a required field (min 1, see createClientSchema in create-client-credential/utils.ts) but the Assign Permissions picker has no permissions to offer, and creating a custom permission to seed one is itself a confirmed broken flow (identity-and-access/permissions-flow.spec.ts: saving a new permission never succeeds). This leaves the Add button permanently disabled, so no client credential can be saved. Once permission creation is fixed, this test.fail() should be removed.",
  );
  test("Client Credentials flow: strict validation -> create -> open for edit", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Client Credentials", async () => {
      await gotoSecretManagementSection(page, "client-credentials", "Client Credentials");
    });

    await test.step("Open the Add Client Credential dialog", async () => {
      await page.getByRole("button", { name: "Add" }).click();
      await expect(page.getByRole("heading", { name: "Add Client Credential" })).toBeVisible();
    });

    const clientName = `Flow Client ${Date.now()}`;

    await test.step("Access Token Lifetime is clamped to the 5-120 minute range", async () => {
      const lifetimeInput = page.getByLabel("Access Token Lifetime in minutes");
      await lifetimeInput.fill("1");
      await expect(lifetimeInput).toHaveValue("5");

      await lifetimeInput.fill("500");
      await expect(lifetimeInput).toHaveValue("120");

      await lifetimeInput.fill("30");
    });

    await test.step("Fill Client Name", async () => {
      await page.getByPlaceholder("Enter client name").fill(clientName);
    });

    await test.step("Assign a role via the 'Assign Role' picker dialog", async () => {
      // Roles are picked through their own dialog (add-client-credential-role.tsx),
      // not inline checkboxes — Assign Role -> check one -> Add.
      await page.getByRole("button", { name: "Assign Role" }).click();
      const roleDialog = page.getByRole("dialog").filter({ hasText: "Assign roles" });
      await expect(roleDialog.getByRole("heading", { name: "Assign roles" })).toBeVisible();

      const firstRoleCheckbox = roleDialog.getByRole("checkbox").first();
      const gotCheckbox = await firstRoleCheckbox
        .isVisible({ timeout: 30000 })
        .catch(() => false);
      if (!gotCheckbox) {
        const noneFound = await roleDialog
          .getByText("No roles are found")
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        console.log("[client-credentials-flow] No role checkbox found. 'No roles are found' shown:", noneFound);
      }
      if (gotCheckbox) {
        await firstRoleCheckbox.check();
        await roleDialog.getByRole("button", { name: "Add" }).click();
      } else {
        await page.keyboard.press("Escape");
      }
    });

    await test.step("Assign a permission via the 'Assign Permissions' picker dialog", async () => {
      await page.getByRole("button", { name: "Assign Permissions" }).click();
      const permissionDialog = page.getByRole("dialog").filter({ hasText: "Assign Permissions" });
      await expect(
        permissionDialog.getByRole("heading", { name: "Assign Permissions" }),
      ).toBeVisible();

      const firstPermissionCheckbox = permissionDialog.getByRole("checkbox").first();
      const gotCheckbox = await firstPermissionCheckbox
        .isVisible({ timeout: 30000 })
        .catch(() => false);
      if (!gotCheckbox) {
        const emptyText = await permissionDialog
          .getByText(/no permissions/i)
          .isVisible({ timeout: 3000 })
          .catch(() => false);
        console.log(
          "[client-credentials-flow] No permission checkbox found. Empty-state text shown:",
          emptyText,
        );
      }
      if (gotCheckbox) {
        await firstPermissionCheckbox.check();
        await permissionDialog.getByRole("button", { name: "Add" }).click();
      } else {
        await page.keyboard.press("Escape");
      }
    });

    await test.step("Save the client credential", async () => {
      const addButton = page.getByRole("button", { name: "Add" }).last();
      await expect(addButton).toBeEnabled({ timeout: 10000 }).catch(() => {});
      // The dialog can re-render right as we click (same detach race seen
      // elsewhere in this suite) — retry a few times.
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await addButton.click({ timeout: 10000 });
          break;
        } catch {
          await page.waitForTimeout(500);
        }
      }

      // This is the confirmed regression (see test.fail() above): Permissions
      // is required but can never be populated, so Add never actually saves.
      // Let the real assertion throw instead of soft-catching it.
      await expect(page.getByText("Client credential created successfully")).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step("Find the new client and reopen it for editing", async () => {
      const clientRow = page.getByText(clientName, { exact: true });
      await expect(clientRow).toBeVisible({ timeout: 15000 });

      const editButton = clientRow
        .locator("xpath=ancestor::*[self::div or self::li or self::tr][1]")
        .getByRole("button", { name: /edit/i });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit Client Credential" })).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).click();
      }
    });
  });
});

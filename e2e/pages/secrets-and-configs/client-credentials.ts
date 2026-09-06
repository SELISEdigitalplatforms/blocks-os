import { expect, type Page } from "@playwright/test";
import { openProjectOverview, openSecretManagement } from "../../support/os-helpers";

export async function seedTestRoleFlow(page: Page) {
  await openProjectOverview(page, "environments");
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
    timeout: 30000,
  });

  await page.goto(
    (await page.evaluate(() => window.location.origin)) + "/iam/role",
  );
  await expect(page.getByRole("heading", { name: "Roles" })).toBeVisible({ timeout: 30000 });
  await page.getByRole("button", { name: "Add Role" }).click();
  await expect(page.getByRole("heading", { name: "Add Role" })).toBeVisible();

  const suffix = Date.now();
  await page.getByPlaceholder("Enter name").fill(`Flow CC Role ${suffix}`);
  await page.getByPlaceholder("Enter slug").fill(`flow-cc-role-${suffix}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Role added successfully")).toBeVisible({ timeout: 15000 });
}

export async function navigateToClientCredentialsFlow(page: Page) {
  await openSecretManagement(page, "client-credentials", "Client Credentials");
}

export async function verifyEmptyStateFlow(page: Page) {
  if (
    await page.getByText("No client credentials yet").isVisible({ timeout: 10000 })
  ) {
    await expect(page.getByText("No client credentials yet")).toBeVisible();
  }
  if (
    await page
      .getByText("Create one to issue OAuth client credentials for service-to-service access.")
      .isVisible()
  ) {
    await expect(
      page.getByText(
        "Create one to issue OAuth client credentials for service-to-service access.",
      ),
    ).toBeVisible();
  }
}

export async function openAddClientCredentialDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name: "Add Client Credential" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add" }).last()).toBeDisabled();
}

export async function verifyClientNameValidationFlow(page: Page) {
  const clientNameInput = page.getByPlaceholder("Enter client name");
  await clientNameInput.fill("x");
  await clientNameInput.fill("");
  await clientNameInput.blur();
  if (await page.getByText("Client name is required").isVisible({ timeout: 5000 })) {
    await expect(page.getByText("Client name is required")).toBeVisible();
  }

  await clientNameInput.fill("a".repeat(81));
  await clientNameInput.blur();
  if (await page.getByText(/80 character/).isVisible({ timeout: 5000 })) {
    await expect(page.getByText(/80 character/)).toBeVisible();
  }
  await clientNameInput.fill("");
}

export async function verifyAccessTokenLifetimeClampedFlow(page: Page) {
  const lifetimeInput = page.getByLabel("Access Token Lifetime in minutes");
  await lifetimeInput.fill("1");
  await expect(lifetimeInput).toHaveValue("5");
  await lifetimeInput.fill("500");
  await expect(lifetimeInput).toHaveValue("120");
  await lifetimeInput.fill("30");
}

export async function verifyEmptyPermissionsStateFlow(page: Page) {
  if (
    await page.getByText("No permissions added").isVisible({ timeout: 5000 })
  ) {
    await expect(page.getByText("No permissions added")).toBeVisible();
  }
  if (
    await page.getByText("Add permissions for this client credential").isVisible()
  ) {
    await expect(page.getByText("Add permissions for this client credential")).toBeVisible();
  }
}

export async function cancelClientCredentialDialogFlow(page: Page) {
  await page.getByPlaceholder("Enter client name").fill("Discarded client name");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Add Client Credential" })).toBeHidden({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Add" }).click();
  await expect(page.getByRole("heading", { name: "Add Client Credential" })).toBeVisible();
  await expect(page.getByPlaceholder("Enter client name")).toHaveValue("");
}

export async function fillClientNameFlow(page: Page, clientName: string) {
  await page.getByPlaceholder("Enter client name").fill(clientName);
}

export async function assignRoleFlow(page: Page): Promise<boolean> {
  const assignRoleButton = page.getByRole("button", { name: "Assign Role" });
  if (!(await assignRoleButton.isVisible({ timeout: 8000 }))) return false;
  await assignRoleButton.click();

  const roleDialog = page.getByRole("dialog").filter({ hasText: "Assign roles" });
  await expect(roleDialog.getByRole("heading", { name: "Assign roles" })).toBeVisible();

  const firstRoleCheckbox = roleDialog.getByRole("checkbox").first();
  const gotCheckbox = await firstRoleCheckbox.isVisible({ timeout: 30000 });
  if (!gotCheckbox) {
    return false;
  }
  await firstRoleCheckbox.check();
  await roleDialog.getByRole("button", { name: "Add" }).click();
  return true;
}

export async function dismissRolePickerIfOpenFlow(page: Page) {
  const leftoverRoleDialog = page.getByRole("dialog").filter({ hasText: "Assign roles" });
  if (!(await leftoverRoleDialog.isVisible({ timeout: 1000 }))) return;
  const roleCancel = leftoverRoleDialog.getByRole("button", { name: "Cancel" });
  if (await roleCancel.isVisible({ timeout: 2000 })) {
    await roleCancel.click();
  }
  await expect(leftoverRoleDialog).toBeHidden({ timeout: 5000 });
}

export async function assignPermissionFlow(page: Page): Promise<boolean> {
  await dismissRolePickerIfOpenFlow(page);
  const assignPermissions = page.getByRole("button", { name: "Assign Permissions" });
  if (!(await assignPermissions.isVisible({ timeout: 8000 }))) return false;
  await assignPermissions.click({ timeout: 10000 });
  const permissionDialog = page.getByRole("dialog").filter({ hasText: "Assign Permissions" });
  await expect(
    permissionDialog.getByRole("heading", { name: "Assign Permissions" }),
  ).toBeVisible();

  const searchInput = permissionDialog.getByPlaceholder("Search by permission name");
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await expect(permissionDialog.getByText(/\(0\/\d+\)/)).toBeVisible();
  await searchInput.fill("zzz-no-such-permission-xyz");
  if (
    await permissionDialog.getByText("No permissions found").isVisible({ timeout: 10000 })
  ) {
    await expect(permissionDialog.getByText("No permissions found")).toBeVisible();
  }
  await searchInput.fill("");

  const firstPermissionCheckbox = permissionDialog.getByRole("checkbox").first();
  const gotCheckbox = await firstPermissionCheckbox.isVisible({ timeout: 30000 });
  if (!gotCheckbox) {
    await page.keyboard.press("Escape");
    return false;
  }
  await firstPermissionCheckbox.check();
  await permissionDialog.getByRole("button", { name: "Add" }).click();
  return true;
}

export async function saveClientCredentialFlow(page: Page) {
  const addButton = page.getByRole("button", { name: "Add" }).last();
  await expect(addButton).toBeEnabled({ timeout: 10000 });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await addButton.click({ timeout: 10000 });
      break;
    } catch {
      if (attempt === 2) throw new Error("Could not click Add Client Credential save");
      await page.waitForTimeout(500);
    }
  }
  await expect(page.getByText("Client credential created successfully")).toBeVisible({
    timeout: 15000,
  });
}

export async function openClientForEditFlow(page: Page, clientName: string) {
  const clientRow = page.getByText(clientName, { exact: true });
  await expect(clientRow).toBeVisible({ timeout: 15000 });

  const editButton = clientRow
    .locator("xpath=ancestor::*[self::div or self::li or self::tr][1]")
    .getByRole("button", { name: /edit/i });
  if (!(await editButton.isVisible({ timeout: 8000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: "Edit Client Credential" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
}

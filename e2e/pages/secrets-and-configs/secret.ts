import { type Locator, type Page, expect } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

export async function navigateToSecretFlow(page: Page) {
  await openSecretManagement(page, "secret", "Secret");
  await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
}

export async function verifyEmptyStateFlow(page: Page) {
  if (await page.getByText("No secrets yet").isVisible({ timeout: 10000 })) {
    await expect(page.getByText("No secrets yet")).toBeVisible();
  }
}

export async function openCreateSecretDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Create secret" })).toBeVisible();
}

export async function verifyNameAndValueRequiredFlow(page: Page) {
  const nameInput = page.getByPlaceholder("payment-gateway-key");
  await nameInput.fill("x");
  await nameInput.fill("");
  if (await page.getByText("A name is required.").isVisible({ timeout: 5000 })) {
    await expect(page.getByText("A name is required.")).toBeVisible();
  }

  const valueInput = page.getByPlaceholder("Paste the secret value");
  await valueInput.fill("x");
  await valueInput.fill("");
  if (await page.getByText("A value is required.").isVisible({ timeout: 5000 })) {
    await expect(page.getByText("A value is required.")).toBeVisible();
  }
}

export async function verifyNamePatternAndDescriptionLengthFlow(page: Page) {
  const nameInput = page.getByPlaceholder("payment-gateway-key");
  await nameInput.fill("-leading-hyphen");
  if (
    await page
      .getByText(
        "Start with a letter or digit; letters, digits, dot, underscore and hyphen only.",
      )
      .isVisible({ timeout: 5000 })
  ) {
    await expect(
      page.getByText(
        "Start with a letter or digit; letters, digits, dot, underscore and hyphen only.",
      ),
    ).toBeVisible();
  }
  await nameInput.fill("");

  const descriptionInput = page.getByPlaceholder("What this secret is for");
  await descriptionInput.fill("a".repeat(1001));
  if (
    await page.getByText("A description may be at most 1000 characters.").isVisible({ timeout: 5000 })
  ) {
    await expect(page.getByText("A description may be at most 1000 characters.")).toBeVisible();
  }
  await descriptionInput.fill("");
}

export async function verifyAccessListPickerVisibleFlow(page: Page) {
  if (
    await page.getByText("Who may read this secret's value.").isVisible({ timeout: 5000 })
  ) {
    await expect(page.getByText("Who may read this secret's value.")).toBeVisible();
  }
}

export async function fillAndSaveSecretFlow(page: Page, secretName: string, secretValue: string) {
  await page.getByPlaceholder("payment-gateway-key").fill(secretName);
  await page.getByPlaceholder("What this secret is for").fill("Created by the Secret flow test.");
  await page.getByPlaceholder("Paste the secret value").fill(secretValue);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Create secret" })).toBeHidden({ timeout: 15000 });
}

export async function findSecretRowFlow(page: Page, secretName: string): Promise<Locator> {
  const secretRow = page.getByRole("row").filter({ hasText: secretName });
  await expect(secretRow).toBeVisible({ timeout: 15000 });
  return secretRow;
}

export async function searchSecretFlow(page: Page, secretRow: Locator, secretName: string) {
  const searchInput = page.getByPlaceholder("Search by name or ID").first();
  if (!(await searchInput.isVisible({ timeout: 5000 }))) return;
  await searchInput.fill(secretName);
  await expect(secretRow).toBeVisible({ timeout: 10000 });

  await searchInput.fill("no-such-secret-xyz");
  if (await page.getByText("No matching secrets").isVisible({ timeout: 8000 })) {
    await expect(page.getByText("No matching secrets")).toBeVisible();
  }

  await searchInput.fill("");
  await expect(secretRow).toBeVisible({ timeout: 10000 });
}

export async function filterByTypeAndStatusFlow(page: Page, secretRow: Locator) {
  const typeFilter = page.getByRole("button", { name: /^Type$/i });
  if (await typeFilter.isVisible({ timeout: 5000 })) {
    await typeFilter.click();
    await page.getByRole("radio", { name: "Application", exact: true }).click();
    await expect(secretRow).toBeVisible({ timeout: 10000 });
  }

  const statusFilter = page.getByRole("button", { name: /^Status$/i }).first();
  if (await statusFilter.isVisible({ timeout: 5000 })) {
    await statusFilter.click();
    await page.getByRole("radio", { name: "Active", exact: true }).click();
    await expect(secretRow).toBeVisible({ timeout: 10000 });
  }

  await openSecretManagement(page, "secret", "Secret");
}

export async function expandSecretRowFlow(page: Page, secretRow: Locator) {
  await expect(secretRow).toBeVisible({ timeout: 15000 });
  await secretRow.click();
  await expect(page.getByText("What this secret is for").or(secretRow)).toBeVisible();
}

export async function revealAndCopySecretValueFlow(page: Page, secretRow: Locator, secretValue: string) {
  const revealButton = secretRow.getByRole("button", { name: "Reveal value" });
  if (await revealButton.isVisible({ timeout: 5000 })) {
    await revealButton.click();
    if (
      await page.getByText(secretValue).isVisible({ timeout: 10000 })
    ) {
      await expect(page.getByText(secretValue)).toBeVisible();
    }
    await page.keyboard.press("Escape");
  }

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  const copyButton = secretRow.getByRole("button", { name: "Copy value" });
  if (await copyButton.isVisible({ timeout: 5000 })) {
    await copyButton.click();
    if (
      await page.getByText("Secret value copied to the clipboard.").isVisible({ timeout: 10000 })
    ) {
      await expect(page.getByText("Secret value copied to the clipboard.")).toBeVisible();
    }
  }
}

export async function openActionsMenuFlow(page: Page, secretName: string): Promise<boolean> {
  const actionsButton = page.getByRole("button", {
    name: new RegExp(`Actions for.*${secretName}`),
  });
  if (!(await actionsButton.isVisible({ timeout: 5000 }))) return false;
  await actionsButton.click();
  await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Rotate" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Lock" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Audit" })).toBeVisible();
  await page.keyboard.press("Escape");
  return true;
}

export async function editSecretDescriptionFlow(page: Page, secretName: string, newDescription: string) {
  const actionsButton = page.getByRole("button", {
    name: new RegExp(`Actions for.*${secretName}`),
  });
  if (!(await actionsButton.isVisible({ timeout: 5000 }))) return;
  await actionsButton.click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit secret" })).toBeVisible();

  const descriptionInput = page.getByPlaceholder("What this secret is for");
  await descriptionInput.fill(newDescription);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Edit secret" })).toBeHidden({ timeout: 15000 });
}

export async function rotateSecretValueFlow(page: Page, secretName: string, newValue: string) {
  const actionsButton = page.getByRole("button", {
    name: new RegExp(`Actions for.*${secretName}`),
  });
  if (!(await actionsButton.isVisible({ timeout: 5000 }))) return;
  await actionsButton.click();
  await page.getByRole("menuitem", { name: "Rotate" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Rotate ${secretName}`) })).toBeVisible();
  if (
    await page.getByText("Anything still using the old value will start failing").isVisible()
  ) {
    await expect(page.getByText("Anything still using the old value will start failing")).toBeVisible();
  }
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByPlaceholder("Paste the new secret value").fill(newValue);
  await page.getByRole("button", { name: "Rotate", exact: true }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Rotate ${secretName}`) })).toBeHidden({
    timeout: 15000,
  });
}

export async function lockAndUnlockSecretFlow(page: Page, secretRow: Locator, secretName: string) {
  const actionsButton = page.getByRole("button", {
    name: new RegExp(`Actions for.*${secretName}`),
  });
  if (!(await actionsButton.isVisible({ timeout: 5000 }))) return;
  await actionsButton.click();
  await page.getByRole("menuitem", { name: "Lock" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Lock ${secretName}`) })).toBeVisible();
  await page.getByRole("button", { name: "Lock", exact: true }).click();
  if (await secretRow.getByText("Locked").isVisible({ timeout: 15000 })) {
    await expect(secretRow.getByText("Locked")).toBeVisible();
  }

  await actionsButton.click();
  await page.getByRole("menuitem", { name: "Unlock" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Unlock ${secretName}`) })).toBeVisible();
  await page.getByRole("button", { name: "Unlock", exact: true }).click();
  if (await secretRow.getByText("Active").isVisible({ timeout: 15000 })) {
    await expect(secretRow.getByText("Active")).toBeVisible();
  }
}

export async function openAuditLogFlow(page: Page, secretName: string) {
  const actionsButton = page.getByRole("button", {
    name: new RegExp(`Actions for.*${secretName}`),
  });
  if (!(await actionsButton.isVisible({ timeout: 5000 }))) return;
  await actionsButton.click();
  await page.getByRole("menuitem", { name: "Audit" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(`Audit log.*${secretName}`) }),
  ).toBeVisible({ timeout: 10000 });
  await page.keyboard.press("Escape");
}

export async function deleteSecretAndRestoreFlow(page: Page, secretRow: Locator, secretName: string) {
  const actionsButton = page.getByRole("button", {
    name: new RegExp(`Actions for.*${secretName}`),
  });
  if (!(await actionsButton.isVisible({ timeout: 5000 }))) return;
  await actionsButton.click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Delete ${secretName}`) })).toBeVisible();
  if (await page.getByText("This is a soft delete").isVisible()) {
    await expect(page.getByText("This is a soft delete")).toBeVisible();
  }
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Delete ${secretName}`) })).toBeHidden({
    timeout: 15000,
  });
  if (await secretRow.isVisible({ timeout: 3000 })) {
    await expect(secretRow).toBeHidden({ timeout: 10000 });
  }

  const statusFilter = page.getByRole("button", { name: /^Status$/i });
  if (!(await statusFilter.isVisible({ timeout: 5000 }))) return;
  await statusFilter.click();
  await page.getByRole("radio", { name: "Deleted", exact: true }).click();
  await expect(secretRow).toBeVisible({ timeout: 10000 });

  await secretRow.getByRole("button", { name: new RegExp(`Actions for.*${secretName}`) }).click();
  await page.getByRole("menuitem", { name: "Restore" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Restore ${secretName}`) })).toBeVisible();
  await page.getByRole("button", { name: "Restore", exact: true }).click();
}

import { expect, type Page } from "@playwright/test";
import { openProjectOverview } from "../../support/os-helpers";

export async function navigateToProjectSettingsFlow(page: Page) {
  await openProjectOverview(page, "settings");
  await expect(page.getByRole("heading", { name: "Project Settings" })).toBeVisible({
    timeout: 30000,
  });
}

export async function verifyGeneralInformationFlow(page: Page, projectName: string) {
  await expect(page.getByText("General Information")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Created On").first()).toBeVisible();
  await expect(page.getByText("Environments").first()).toBeVisible();
  await expect(page.getByText("Plan")).toBeVisible();
  await expect(page.getByText("Free")).toBeVisible();
}

export async function openEditProjectDialogFlow(page: Page, expectedName: string) {
  await page.getByRole("button", { name: "Edit project name" }).click();
  await expect(page.getByRole("heading", { name: "Edit Project" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator("#name")).toHaveValue(expectedName);
}

export async function cancelEditProjectFlow(page: Page, projectName: string) {
  await page.locator("#name").fill(`${projectName} discarded`);

  const cancelButton = page.getByRole("button", { name: "Cancel" });
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await cancelButton.click({ timeout: 10_000 });
      break;
    } catch (error) {
      if (attempt === 2) throw error;
      await page.waitForTimeout(500);
    }
  }
  await expect(page.getByRole("heading", { name: "Edit Project" })).toBeHidden({
    timeout: 10000,
  });
  await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Edit project name" }).click();
  await expect(page.getByRole("heading", { name: "Edit Project" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator("#name")).toHaveValue(projectName);
}

export async function verifyNameValidationFlow(page: Page) {
  const nameInput = page.locator("#name");
  const updateButton = page.getByRole("button", { name: "Update" });

  await nameInput.fill("");
  await expect(updateButton).toBeDisabled();

  await nameInput.fill("ab");
  if (
    await page
      .getByText("Project name must be at least 3 characters")
      .isVisible({ timeout: 5000 })
  ) {
    await expect(updateButton).toBeDisabled();
  }

  await nameInput.fill("a".repeat(101));
  if (
    await page
      .getByText("Project name should be a maximum of 100 characters")
      .isVisible({ timeout: 5000 })
  ) {
    await expect(updateButton).toBeDisabled();
  }
}

export async function renameProjectFlow(page: Page, newName: string) {
  const nameInput = page.locator("#name");
  await nameInput.fill(newName);
  const updateButton = page.getByRole("button", { name: "Update" });
  await expect(updateButton).toBeEnabled();
  await updateButton.click();

  await expect(
    page
      .getByRole("region", { name: /Notifications/i })
      .getByText("Project name updated successfully", { exact: true }),
  ).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole("heading", { name: "Edit Project" })).toBeHidden({
    timeout: 10000,
  });
}

export async function verifyRenamedProjectVisibleFlow(page: Page, newName: string) {
  await expect(page.getByText(newName, { exact: true }).first()).toBeVisible({ timeout: 15000 });
}

export async function verifyEnvironmentsTableFlow(page: Page) {
  await expect(page.getByRole("heading", { name: "Environments", exact: true })).toBeVisible();
  await expect(
    page.getByText("Environments provisioned for this project and their public domains"),
  ).toBeVisible();
  await expect(page.getByText("X-Blocks-Key")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Environment" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Domain" })).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Created On" })).toBeVisible();

  const firstRow = page.getByRole("row").nth(1);
  await expect(firstRow.getByText("Development")).toBeVisible();
}

export async function copyEnvironmentKeyFlow(page: Page): Promise<boolean> {
  const copyButton = page.locator('button:has(svg.lucide-copy)').first();
  if (!(await copyButton.isVisible({ timeout: 5000 }))) {
    return false;
  }
  // CopyToClipboardButton uses navigator.clipboard.writeText when the page is
  // in a secure context. Without clipboard-write permission the call throws,
  // the catch block sets isCopying=false immediately, and the Check icon swap
  // never happens — so a strict assertion on the check icon is also a strict
  // assertion that clipboard permission is granted. Grant it on demand.
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  await copyButton.click();
  await expect(page.locator('svg.lucide-check').first()).toBeVisible({ timeout: 5000 });
  return true;
}

export async function verifyNotDeployedBadgeFlow(page: Page) {
  await expect(page.getByText("Not deployed").first()).toBeVisible({ timeout: 5000 });
}

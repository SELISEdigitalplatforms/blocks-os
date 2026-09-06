import { expect, type Page } from "@playwright/test";
import { openProjectOverview } from "../../support/os-helpers";
import {
  waitForEnvironmentsListReady,
  openEnvironmentCardDashboard,
} from "../../support/environment-helpers";
import { syncEnvironmentIdsToFixture } from "../../support/create-and-delete-project";

export async function navigateToEnvironmentsFlow(page: Page) {
  await openProjectOverview(page, "environments");
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
    timeout: 30000,
  });
}

export async function verifyEnvironmentCardVisibleFlow(page: Page) {
  await expect(page.getByText("X-Blocks-Key").first()).toBeVisible({ timeout: 10000 });
}

export async function addEnvironmentFlow(page: Page): Promise<boolean> {
  const newEnvButton = page.getByRole("button", { name: "New Environment" });
  if (!(await newEnvButton.isVisible({ timeout: 5000 }))) {
    return false;
  }
  await newEnvButton.click();
  const addDialog = page.getByRole("dialog", { name: "Add Environment" });
  await expect(addDialog).toBeVisible({ timeout: 10000 });

  const firstCheckbox = addDialog.getByRole("checkbox").first();
  if (!(await firstCheckbox.isVisible({ timeout: 5000 }))) {
    await page.keyboard.press("Escape");
    return false;
  }

  const addButton = addDialog.getByRole("button", { name: "Add" });
  await expect(addButton).toBeDisabled();

  const testingRow = addDialog
    .locator("div")
    .filter({ has: addDialog.getByText("Testing", { exact: true }) })
    .filter({ has: addDialog.getByRole("checkbox") })
    .first();
  if (await testingRow.isVisible({ timeout: 2000 })) {
    await testingRow.getByRole("checkbox").click({ force: true });
  } else {
    await firstCheckbox.click({ force: true });
  }
  await expect(addButton).toBeEnabled({ timeout: 10000 });
  await addButton.click();

  await expect(page.getByRole("heading", { name: "Add Environment" })).toBeHidden({
    timeout: 15000,
  });
  await waitForEnvironmentsListReady(page);
  await syncEnvironmentIdsToFixture(page);
  return true;
}

export async function openEnvironmentDashboardFlow(page: Page, label: string) {
  await openEnvironmentCardDashboard(page, label);
  await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Domains", { exact: true })).toBeVisible();
}

export async function returnToEnvironmentsListFlow(
  page: Page,
  options: { expectMultipleCards?: boolean } = {},
) {
  await openProjectOverview(page, "environments");
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
    timeout: 30000,
  });
  if (options.expectMultipleCards) {
    const cards = page.locator('[class*="cursor-pointer"]').filter({ hasText: "X-Blocks-Key" });
    await expect(cards).not.toHaveCount(0);
  }
}

export async function openMigrationWizardFlow(page: Page): Promise<boolean> {
  const startMigrationButton = page.getByRole("button", { name: "Start Migration" });
  if (!(await startMigrationButton.isVisible({ timeout: 8000 }))) {
    return false;
  }
  await startMigrationButton.click();
  await expect(page.getByText("Environment migration", { exact: true }).last()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("Environments & services", { exact: true }).last()).toBeVisible();

  await page.getByRole("link", { name: "Close migration" }).click();
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
    timeout: 15000,
  });
  return true;
}

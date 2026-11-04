import { expect, type Locator, type Page } from "@playwright/test";
import { openProjectOverview, waitForProjectOverviewSettled } from "../../support/os-helpers";
import {
  waitForEnvironmentsListReady,
  openEnvironmentCardDashboard,
} from "../../support/environment-helpers";
import { syncEnvironmentIdsToFixture } from "../../support/create-and-delete-project";
import { isLoginSurface } from "../../support/login-helper";
import { refreshSuiteSession } from "../../support/session-lifecycle";

export async function navigateToEnvironmentsFlow(page: Page) {
  await openProjectOverview(page, "environments");
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
    timeout: 30000,
  });
}

export async function verifyEnvironmentCardVisibleFlow(page: Page) {
  await expect(page.getByText("X-Blocks-Key").first()).toBeVisible({ timeout: 10000 });
}

/**
 * Waits up to `timeout` for the locator to show. Unlike locator.isVisible(),
 * which ignores its timeout and checks only once.
 */
function waitUntilVisible(locator: Locator, timeout: number): Promise<boolean> {
  return locator
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false);
}

/**
 * Opens the Add Environment dialog and selects a row, returning its (still
 * disabled-until-checked) Add button. Returns null when there's nothing to
 * add (no New Environment button, or no environment left to pick).
 */
async function openAddEnvironmentDialogAndSelect(page: Page) {
  const newEnvButton = page.getByRole("button", { name: "New Environment" });
  if (!(await waitUntilVisible(newEnvButton, 15000))) {
    return null;
  }
  await newEnvButton.click();
  const addDialog = page.getByRole("dialog", { name: "Add Environment" });
  await expect(addDialog).toBeVisible({ timeout: 10000 });

  const firstCheckbox = addDialog.getByRole("checkbox").first();
  if (!(await waitUntilVisible(firstCheckbox, 5000))) {
    await page.keyboard.press("Escape");
    return null;
  }

  const addButton = addDialog.getByRole("button", { name: "Add" });
  await expect(addButton).toBeDisabled();

  // `has` locators are resolved inside each candidate div, so they must start
  // from `page`, not `addDialog` — a dialog-rooted inner locator never matches.
  const testingRow = addDialog
    .locator("div")
    .filter({ has: page.getByText("Testing", { exact: true }) })
    .filter({ has: page.getByRole("checkbox") })
    .last();
  const checkbox =
    (await testingRow.count()) > 0 ? testingRow.getByRole("checkbox") : firstCheckbox;

  // No force-click: the dialog slides in, and a forced click computed mid-
  // animation lands on dialog padding without toggling anything. A plain
  // click waits for the checkbox to be stable; retry until it really is
  // checked in case the first click still raced the animation.
  await expect(async () => {
    if (!(await checkbox.isChecked())) await checkbox.click();
    await expect(checkbox).toBeChecked({ timeout: 1000 });
  }).toPass({ timeout: 10000 });
  await expect(addButton).toBeEnabled({ timeout: 10000 });
  return addButton;
}

export async function addEnvironmentFlow(page: Page): Promise<boolean> {
  let addButton = await openAddEnvironmentDialogAndSelect(page);
  if (!addButton) return false;

  const maxAttempts = 3;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await addButton.click({ timeout: 20_000 });
      await expect(page.getByRole("heading", { name: "Add Environment" })).toBeHidden({
        timeout: 15000,
      });
      await waitForEnvironmentsListReady(page);
      await syncEnvironmentIdsToFixture(page);
      return true;
    } catch (error) {
      // The suite session can expire mid-click: the app's own silent token
      // refresh is broken (see session-lifecycle.ts), so it hard-redirects to
      // /login and wipes the dialog out from under the click — Playwright
      // just keeps retrying against a detached element until the test times
      // out. Recover with a real re-login and start the dialog over, same
      // idiom as openEnvironmentCardDashboard in environment-helpers.ts.
      if (attempt < maxAttempts - 1 && (await isLoginSurface(page))) {
        await refreshSuiteSession(page);
        await navigateToEnvironmentsFlow(page);
        addButton = await openAddEnvironmentDialogAndSelect(page);
        if (!addButton) return false;
        continue;
      }
      throw error;
    }
  }
  return false;
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

/** Reads the "N of 8 environments used" header count on the Environments page. */
export async function readAccessibleEnvironmentCount(page: Page): Promise<number> {
  const usage = page.getByText(/^\d+ of 8 environments used$/);
  await expect(usage).toBeVisible({ timeout: 15000 });
  const text = (await usage.textContent()) ?? "";
  return Number.parseInt(text, 10);
}

export const START_MIGRATION_DISABLED_TOOLTIP = "Add another environment to start a migration.";

/**
 * With one accessible environment, Start Migration is rendered disabled: clicking it must not
 * leave the Environments page, and the focusable wrapper explains why.
 */
export async function verifyStartMigrationDisabledFlow(page: Page) {
  const startMigrationButton = page.getByRole("button", { name: "Start Migration" });
  await expect(startMigrationButton).toBeVisible({ timeout: 8000 });
  await expect(startMigrationButton).toBeDisabled();
  const urlBefore = page.url();
  await startMigrationButton.click({ force: true });
  await expect(page).toHaveURL(urlBefore);
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible();

  await page.getByTestId("start-migration-disabled-trigger").focus();
  await expect(
    page.getByRole("tooltip").filter({ hasText: START_MIGRATION_DISABLED_TOOLTIP }).first(),
  ).toBeVisible({ timeout: 10000 });
}

async function pickEnvironmentOption(page: Page, trigger: string, index: number) {
  const combobox = page.getByRole("combobox", { name: trigger });
  const listbox = page.getByRole("listbox");
  let label = "";
  // A click that lands while the Select is still animating open can close it
  // without picking anything, leaving the placeholder in place. Retry until
  // the trigger actually shows the picked option.
  await expect(async () => {
    if (!(await listbox.isVisible())) await combobox.click();
    await expect(listbox).toBeVisible({ timeout: 5000 });
    const option = listbox.getByRole("option").nth(index);
    label = ((await option.textContent()) ?? "").trim();
    await option.click();
    await expect(listbox).toBeHidden({ timeout: 2000 });
    await expect(combobox).toContainText(label, { timeout: 2000 });
  }).toPass({ timeout: 20000 });
  return label;
}

/**
 * In wizard step 1: pick two environments, clear the source, and confirm the cleared selector
 * resets without touching the target, then swap the environments.
 */
export async function verifyClearableEnvironmentSelectorsFlow(page: Page) {
  const source = page.getByRole("combobox", { name: "Source environment" });
  const target = page.getByRole("combobox", { name: "Target environment" });
  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(source).toBeEnabled({ timeout: 15000 });

  await expect(page.getByRole("button", { name: "Clear source environment" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Clear target environment" })).toHaveCount(0);

  const sourceLabel = await pickEnvironmentOption(page, "Source environment", 0);
  const targetLabel = await pickEnvironmentOption(page, "Target environment", 1);
  await expect(source).toContainText(sourceLabel);
  await expect(target).toContainText(targetLabel);

  const clearSource = page.getByRole("button", { name: "Clear source environment" });
  const clearTarget = page.getByRole("button", { name: "Clear target environment" });
  await expect(clearSource).toBeVisible();
  await expect(clearTarget).toBeVisible();

  await clearSource.click();
  await expect(source).toContainText("Select source environment");
  await expect(clearSource).toHaveCount(0);
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(source).toBeFocused();
  await expect(target).toContainText(targetLabel);
  await expect(continueButton).toBeDisabled();

  await clearTarget.click();
  await expect(target).toContainText("Select target environment");
  await expect(target).toBeFocused();

  // The environment previously used as Target is selectable as Source again.
  await source.click();
  const swappedOption = page.getByRole("listbox").getByRole("option", { name: targetLabel });
  await expect(swappedOption).toBeVisible({ timeout: 10000 });
  await expect(swappedOption).not.toHaveAttribute("data-disabled");
  await swappedOption.click();
  await expect(source).toContainText(targetLabel);
}

export async function closeMigrationWizardFlow(page: Page) {
  await page.getByRole("link", { name: "Close migration" }).click();
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
    timeout: 15000,
  });
}

/**
 * Opens the migration wizard from Start Migration when the project has two or more accessible
 * environments. With one environment the button is disabled instead, so that state is asserted
 * rather than waiting for a wizard that cannot open. Returns whether the wizard was opened.
 */
export async function openMigrationWizardFlow(
  page: Page,
  options: { exerciseClear?: boolean } = {},
): Promise<boolean> {
  const startMigrationButton = page.getByRole("button", { name: "Start Migration" });
  // Allow for the "Returning to the console…" screen the project-overview
  // layout shows while it ends a lingering environment impersonation.
  if (!(await waitUntilVisible(startMigrationButton, 30000))) {
    return false;
  }
  const environmentCount = await readAccessibleEnvironmentCount(page);
  if (environmentCount < 2) {
    await verifyStartMigrationDisabledFlow(page);
    return false;
  }

  await expect(startMigrationButton).toBeEnabled();
  await expect(page.getByTestId("start-migration-disabled-trigger")).toHaveCount(0);
  await startMigrationButton.click();
  await expect(page.getByText("Environment migration", { exact: true }).last()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("Environments & services", { exact: true }).last()).toBeVisible();
  // The wizard can still be swapped for the full-screen loading spinner and
  // remounted right after it first shows. If that happens while a Select is
  // open, the Select is torn down mid-open and leaves the page ignoring
  // pointer events, so every later click fails. Let it settle first.
  await waitForProjectOverviewSettled(
    page,
    page.getByRole("combobox", { name: "Source environment" }),
  );

  if (options.exerciseClear) {
    await verifyClearableEnvironmentSelectorsFlow(page);
  }

  await closeMigrationWizardFlow(page);
  return true;
}

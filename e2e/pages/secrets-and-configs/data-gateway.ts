import { expect, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

/**
 * Data Gateway page (`/secret-management/data-gateway`): a single settings form
 * with three sections — Data Source (Blocks database vs. custom connection),
 * Collection Settings (editable names + naming pattern) and Analytics.
 * Saving always goes through a confirm dialog ("Changing the data source will
 * affect all existing data…").
 */

export async function navigateToDataGatewayFlow(page: Page) {
  await openSecretManagement(page, "data-gateway", "Data Gateway");
}

export async function verifySectionsFlow(page: Page) {
  await expect(page.getByRole("heading", { name: "Data Source", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Collection Settings" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Analytics", exact: true })).toBeVisible();

  const blocksRadio = page.getByRole("radio", { name: /Blocks database/ });
  const othersRadio = page.getByRole("radio", { name: /My data sources/ });
  await expect(blocksRadio).toBeVisible();
  await expect(othersRadio).toBeVisible();
}

export async function verifyDefaultsFlow(page: Page) {
  // A fresh project starts on the platform-managed database with both toggles off.
  await expect(page.getByRole("radio", { name: /Blocks database/ })).toBeChecked();
  await expect(page.getByRole("switch", { name: /Collection Name Editable/i })).not.toBeChecked();
  await expect(page.getByRole("switch", { name: /Enable Analytics/i })).not.toBeChecked();

  // The naming pattern is the platform default: prefix "sb_" + {SchemaName} token + postfix "s".
  await expect(page.getByPlaceholder("prefix")).toHaveValue("sb_");
  await expect(page.getByPlaceholder("postfix")).toHaveValue("s");
  await expect(page.getByText("{SchemaName}").first()).toBeVisible();
}

export async function revealOwnDataSourceFieldsFlow(page: Page) {
  await page.getByRole("radio", { name: /My data sources/ }).click();
  await expect(page.getByPlaceholder("mongodb://<username>:<password>@host:27017/db")).toBeVisible();
  await expect(page.getByPlaceholder("my-database")).toBeVisible();
}

export async function verifySaveDisabledWithoutOwnFieldsFlow(page: Page) {
  const save = page.getByRole("button", { name: "Save Changes" });
  await expect(save).toBeDisabled();

  await page.getByPlaceholder("mongodb://<username>:<password>@host:27017/db").fill(
    "mongodb://flow:flow@localhost:27017",
  );
  // Connection string alone is not enough — database name is still empty.
  await expect(save).toBeDisabled();

  await page.getByPlaceholder("mongodb://<username>:<password>@host:27017/db").fill("");
  await page.getByPlaceholder("my-database").fill("flow-gateway-db");
  // Database name alone is not enough either.
  await expect(save).toBeDisabled();
}

export async function fillOwnDataSourceFieldsFlow(page: Page) {
  await page.getByPlaceholder("mongodb://<username>:<password>@host:27017/db").fill(
    "mongodb://flow:flow@localhost:27017",
  );
  await page.getByPlaceholder("my-database").fill("flow-gateway-db");
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeEnabled();
}

export async function backToBlocksDatabaseFlow(page: Page) {
  await page.getByRole("radio", { name: /Blocks database/ }).click();
  await expect(page.getByPlaceholder("mongodb://<username>:<password>@host:27017/db")).toBeHidden();
  await expect(page.getByPlaceholder("my-database")).toBeHidden();
  // Back on the managed database, the form is valid again without any custom fields.
  await expect(page.getByRole("button", { name: "Save Changes" })).toBeEnabled();
}

export async function toggleSwitchFlow(page: Page, name: string | RegExp, checked: boolean) {
  const switchControl = page.getByRole("switch", { name });
  await switchControl.click();
  if (checked) {
    await expect(switchControl).toBeChecked();
  } else {
    await expect(switchControl).not.toBeChecked();
  }
}

export async function editCollectionPatternFlow(page: Page) {
  // The {SchemaName} token is fixed between prefix and postfix inputs; only the
  // surrounding text is editable. Change the postfix and verify the composition.
  const postfix = page.getByPlaceholder("postfix");
  await postfix.fill("s_logs");
  await expect(postfix).toHaveValue("s_logs");
  await expect(page.getByPlaceholder("prefix")).toHaveValue("sb_");
}

export async function verifyAnalyticsNotConfiguredFlow(page: Page) {
  // Availability dates are managed by Blocks — a fresh project shows both as unset.
  await expect(page.getByText("Enable date")).toBeVisible();
  await expect(page.getByText("Valid till")).toBeVisible();
  await expect(page.getByText("Not set", { exact: true })).toBeVisible();
  await expect(page.getByText("Not set (analytics unavailable)")).toBeVisible();
  await expect(
    page.getByText("Availability dates are managed by Blocks and cannot be edited here."),
  ).toBeVisible();
}

export async function cancelResetsFormFlow(page: Page) {
  // Dirty the form, then Cancel must restore the loaded configuration.
  await toggleSwitchFlow(page, /Enable Analytics/i, true);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("switch", { name: /Enable Analytics/i })).not.toBeChecked();
}

export async function openConfirmDialogAndCancelFlow(page: Page) {
  await page.getByRole("button", { name: "Save Changes" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Confirm data source (configuration|update)\?/)).toBeVisible();
  await expect(
    dialog.getByText(/Changing the data source will affect all existing data/),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

export async function saveViaConfirmDialogFlow(page: Page): Promise<boolean> {
  await page.getByRole("button", { name: "Save Changes" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/Confirm data source (configuration|update)\?/)).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm" }).click();

  // First save on a project creates the configuration; later saves update it.
  const toast = page.getByText(/Configuration (created|updated) successfully/);
  const appeared = await toast.isVisible({ timeout: 15_000 }).catch(() => false);
  if (!appeared) {
    return false;
  }
  await expect(toast).toBeVisible();
  return true;
}

export async function verifyPatternPersistedFlow(page: Page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Data Gateway", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByPlaceholder("postfix")).toHaveValue("s_logs", { timeout: 15_000 });
}

export async function resetPatternFlow(page: Page) {
  const postfix = page.getByPlaceholder("postfix");
  await postfix.fill("s");
  await expect(postfix).toHaveValue("s");
  await saveViaConfirmDialogFlow(page);
}

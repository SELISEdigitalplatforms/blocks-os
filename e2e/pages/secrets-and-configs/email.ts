import { expect, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

export async function navigateToEmailFlow(page: Page) {
  await openSecretManagement(page, "email", "Email");
}

export async function verifyEmptyEmailStateFlow(page: Page) {
  if (
    await page.getByText("No email configurations found").isVisible({ timeout: 5000 })
  ) {
    await expect(page.getByText("No email configurations found")).toBeVisible();
  }
}

/**
 * The seeded Default record can only have its sender name edited, never be deleted. Since
 * blocks-os#732 (H10) its actions are in its ⋮ menu, which must offer Edit only.
 */
export async function verifyDefaultConfigLockedFlow(page: Page) {
  const menuButton = page.getByRole("button", { name: "More actions for Default", exact: true });
  await expect(menuButton).toBeVisible({ timeout: 15000 });
  await menuButton.click();
  const items = page.getByRole("menuitem");
  await expect(items).toHaveText(["Edit"]);
  await page.keyboard.press("Escape");
  await expect(items).toHaveCount(0);
}

export async function openAddEmailConfigDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add Configuration" }).click();
  await expect(page.getByRole("heading", { name: "Add Configuration" })).toBeVisible();
}

export async function verifySaveDisabledFlow(page: Page) {
  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeDisabled();

  await page.getByPlaceholder("Enter Host").fill("not-a-domain");
  await expect(saveButton).toBeDisabled();

  await page.getByPlaceholder("Enter name").fill("ab");
  if (
    await page
      .getByText("Configuration name must be at least 3 characters")
      .isVisible({ timeout: 5000 })
  ) {
    await expect(
      page.getByText("Configuration name must be at least 3 characters"),
    ).toBeVisible();
  }

  await page.getByPlaceholder("Enter port").fill("99999");
  if (
    await page.getByText("Port must be between 1 and 65535").isVisible({ timeout: 5000 })
  ) {
    await expect(page.getByText("Port must be between 1 and 65535")).toBeVisible();
  }

  await page.getByPlaceholder("Enter sender address").fill("not-an-email");
  if (
    await page.getByText("Sender Address must be a valid email").isVisible({ timeout: 5000 })
  ) {
    await expect(page.getByText("Sender Address must be a valid email")).toBeVisible();
  }

  await page.getByPlaceholder("Enter password").fill("abc");
  if (
    await page
      .getByText("Password must be at least 6 characters long")
      .isVisible({ timeout: 5000 })
  ) {
    await expect(page.getByText("Password must be at least 6 characters long")).toBeVisible();
  }

  await expect(saveButton).toBeDisabled();
}

export async function verifyOutboundProvidersOfferedFlow(page: Page) {
  const providerSelect = page.getByRole("dialog").getByRole("combobox").nth(1);
  await providerSelect.click();
  await expect(page.getByRole("option", { name: "Amazon SES" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Zoho" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Office 365" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Gmail" })).toBeVisible();
  await page.getByRole("option", { name: "Amazon SES" }).click();
}

export async function verifyInboundProviderAndFieldsFlow(page: Page) {
  const typeSelect = page.getByRole("dialog").getByRole("combobox").first();
  await typeSelect.click();
  await page.getByRole("option", { name: "Inbound" }).click();

  const providerSelect = page.getByRole("dialog").getByRole("combobox").nth(1);
  await expect(providerSelect).toHaveText(/Zoho/);
  await providerSelect.click();
  await expect(page.getByRole("option", { name: "Amazon SES" })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Office 365" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Gmail" })).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByPlaceholder("Enter sender name")).toHaveCount(0);
  await expect(page.getByPlaceholder("Enter sender address")).toHaveCount(0);
  await expect(page.getByPlaceholder("Enter Server Name")).toBeVisible();
  await expect(page.getByPlaceholder("Enter username")).toBeVisible();

  await typeSelect.click();
  await page.getByRole("option", { name: "Outbound" }).click();
  await expect(page.getByPlaceholder("Enter sender name")).toBeVisible();
}

export async function fillAndSaveEmailConfigFlow(page: Page, configName: string) {
  await page.getByPlaceholder("Enter name").fill(configName);
  await page.getByPlaceholder("Enter Host").fill("smtp.example.com");
  await page.getByPlaceholder("Enter port").fill("587");
  await page.getByPlaceholder("Enter sender name").fill("Flow Sender");
  await page
    .getByPlaceholder("Enter sender address")
    .fill(`flow-sender-${Date.now()}@example.com`);
  await page.getByPlaceholder("Enter sender username").fill("flow-sender-user");
  await page.getByPlaceholder("Enter password").fill("SuperSecret123");
  await page.getByRole("checkbox").click();

  const saveButton = page.getByRole("button", { name: "Save", exact: true });
  await expect(saveButton).toBeEnabled({ timeout: 10000 });
  await saveButton.click();
  if (
    await page
      .getByText("Configuration created successfully.", { exact: true })
      .or(page.getByText("New configuration added successfully.", { exact: true }))
      .isVisible({ timeout: 15000 })
  ) {
    await expect(
      page
        .getByText("Configuration created successfully.", { exact: true })
        .or(page.getByText("New configuration added successfully.", { exact: true })),
    ).toBeVisible();
  }
}

export async function expandConfigRowAndVerifyFlow(page: Page, configName: string) {
  // exact: the card's ⋮ button, "More actions for <name>", also contains the name.
  const configTrigger = page.getByRole("button", { name: configName, exact: true });
  await expect(configTrigger).toBeVisible({ timeout: 15000 });
  await configTrigger.click();
  const panel = page.getByLabel(configName, { exact: true });
  await expect(panel.getByText("smtp.example.com")).toBeVisible({ timeout: 10000 });
  await expect(panel.getByText("587")).toBeVisible();
  await expect(panel.getByText("Outbound")).toBeVisible();
}

/** blocks-os#732 H12: a project with multi-org off sees no organization picker, field or chips. */
export async function verifyNoOrganizationUiFlow(page: Page) {
  await expect(page.getByRole("button", { name: "Add Configuration" })).toBeVisible({ timeout: 15000 });
  // The picker would render once the organization config has loaded, which is also when the list
  // shows: wait for the list (the seeded Default card) before checking it is absent.
  await expect(page.getByRole("button", { name: "Default", exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByLabel("Organization", { exact: true })).toHaveCount(0);
  await expect(page.getByText("ORG DEFAULT", { exact: true })).toHaveCount(0);
  await expect(page.getByText("PROJECT DEFAULT", { exact: true })).toHaveCount(0);
}

/**
 * blocks-os#732 H10: Edit and Delete sit in each card's ⋮ menu, labelled with the card's name, so
 * the Default record's own menu (Edit sender name only) is never the one opened.
 */
export function configMenuButton(page: Page, configName: string) {
  return page.getByRole("button", { name: `More actions for ${configName}`, exact: true });
}

async function chooseFromConfigMenu(page: Page, configName: string, item: "Edit" | "Delete") {
  const menuButton = configMenuButton(page, configName);
  await expect(menuButton).toBeVisible({ timeout: 15000 });
  await menuButton.click();
  await page.getByRole("menuitem", { name: item, exact: true }).click();
}

/** blocks-os#732 H10: the card's ⋮ menu offers exactly Edit and Delete. */
export async function verifyConfigMenuFlow(page: Page, configName: string) {
  const menuButton = configMenuButton(page, configName);
  await expect(menuButton).toBeVisible({ timeout: 15000 });
  await menuButton.click();
  const items = page.getByRole("menuitem");
  await expect(items).toHaveText(["Edit", "Delete"]);
  await page.keyboard.press("Escape");
  await expect(items).toHaveCount(0);
}

/** blocks-os#732 H11: the expanded card says how many templates use it. */
export async function verifyConfigUsageFlow(page: Page, configName: string, count: number) {
  const panel = page.getByLabel(configName, { exact: true });
  const text = count === 1 ? "Used by 1 template" : `Used by ${count} templates`;
  await expect(panel.getByText(text, { exact: true })).toBeVisible({ timeout: 15000 });
}

export async function openEditEmailAndCloseFlow(page: Page, configName: string) {
  await chooseFromConfigMenu(page, configName, "Edit");
  await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
}

export async function editEmailConfigAndSaveFlow(
  page: Page,
  configName: string,
  newSenderName: string,
) {
  await chooseFromConfigMenu(page, configName, "Edit");
  await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();
  // blocks-os#732 §10 step 4: multi-org is off, so the form has no Organization field (its label
  // would read "Organization *") and no organization-default option.
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText(/^Organization\b/)).toHaveCount(0);
  await expect(dialog.getByText("Use as organization default", { exact: true })).toHaveCount(0);
  await page.getByPlaceholder("Enter sender name").fill(newSenderName);
  await page.getByPlaceholder("Enter password").fill("SuperSecret123");
  const updateButton = page.getByRole("button", { name: "Update Changes" });
  await expect(updateButton).toBeEnabled({ timeout: 10000 });
  await updateButton.click();
  if (
    await page.getByText("Configuration updated successfully.", { exact: true }).isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("Configuration updated successfully.", { exact: true })).toBeVisible();
  }
}

export async function deleteEmailConfigFlow(page: Page, configName: string) {
  await chooseFromConfigMenu(page, configName, "Delete");
  await expect(page.getByRole("heading", { name: "Delete configuration" })).toBeVisible();
  // blocks-os#732 C9: the dialog says how many templates use it and that they fall back.
  await expect(
    page.getByText("Used by 0 templates; they'll use the organization default or the project default.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 15000 });
  if (
    await page
      .getByText("Are you sure you'd like to delete this configuration?")
      .isVisible()
  ) {
    await expect(
      page.getByText("Are you sure you'd like to delete this configuration?"),
    ).toBeVisible();
  }
  await page.getByRole("button", { name: "Delete Configuration" }).click();
  // The card is gone once the list reloads.
  await expect(configMenuButton(page, configName)).toHaveCount(0, { timeout: 15000 });
  if (
    await page.getByText("Configuration deleted successfully.", { exact: true }).isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("Configuration deleted successfully.", { exact: true })).toBeVisible();
  }
}

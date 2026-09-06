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

export async function verifyDefaultConfigLockedFlow(page: Page) {
  const defaultTrigger = page.getByRole("button", { name: "Default" });
  if (!(await defaultTrigger.isVisible({ timeout: 5000 }))) return;
  await defaultTrigger.click();
  const defaultPanel = page.getByLabel("Default");
  await expect(defaultPanel.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(defaultPanel.getByRole("button", { name: "Delete" })).toHaveCount(0);
  await defaultTrigger.click();
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
      .getByText("Configuration created successfully.")
      .or(page.getByText("New configuration added successfully."))
      .isVisible({ timeout: 15000 })
  ) {
    await expect(
      page
        .getByText("Configuration created successfully.")
        .or(page.getByText("New configuration added successfully.")),
    ).toBeVisible();
  }
}

export async function expandConfigRowAndVerifyFlow(page: Page, configName: string) {
  const configTrigger = page.getByRole("button", { name: configName });
  await expect(configTrigger).toBeVisible({ timeout: 15000 });
  await configTrigger.click();
  const panel = page.getByLabel(configName);
  await expect(panel.getByText("smtp.example.com")).toBeVisible({ timeout: 10000 });
  await expect(panel.getByText("587")).toBeVisible();
  await expect(panel.getByText("Outbound")).toBeVisible();
}

export async function openEditEmailAndCloseFlow(page: Page) {
  const editButton = page.getByRole("button", { name: "Edit", exact: true }).first();
  if (!(await editButton.isVisible({ timeout: 8000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
}

export async function editEmailConfigAndSaveFlow(page: Page, newSenderName: string) {
  const editButton = page.getByRole("button", { name: "Edit", exact: true }).first();
  if (!(await editButton.isVisible({ timeout: 8000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();
  await page.getByPlaceholder("Enter sender name").fill(newSenderName);
  await page.getByPlaceholder("Enter password").fill("SuperSecret123");
  const updateButton = page.getByRole("button", { name: "Update Changes" });
  await expect(updateButton).toBeEnabled({ timeout: 10000 });
  await updateButton.click();
  if (
    await page.getByText("Configuration updated successfully.").isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("Configuration updated successfully.")).toBeVisible();
  }
}

export async function deleteEmailConfigFlow(page: Page) {
  const deleteButton = page.getByRole("button", { name: "Delete", exact: true }).first();
  if (!(await deleteButton.isVisible({ timeout: 8000 }))) return;
  await deleteButton.click();
  await expect(page.getByRole("heading", { name: "Delete configuration" })).toBeVisible();
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
  if (
    await page.getByText("Configuration deleted successfully.").isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("Configuration deleted successfully.")).toBeVisible();
  }
}

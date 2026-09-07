import { expect, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

export async function navigateToIdentityProvidersFlow(page: Page) {
  await openSecretManagement(page, "identity-providers", "Identity Provider");
}

/** The "Enterprise & custom" gallery section, which holds the Blocks OIDC / BYOS cards. */
function enterpriseSection(page: Page) {
  return page.getByRole("heading", { name: "Enterprise & custom" }).locator("..");
}

export async function verifyEmptyStateFlow(page: Page) {
  await expect(page.getByText("How a federated sign-in works")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Social logins")).toBeVisible();
  await expect(page.getByText("Enterprise & custom")).toBeVisible();
  // Nothing configured yet, so no entries are listed inside the enterprise cards.
  await expect(enterpriseSection(page).getByRole("listitem")).toHaveCount(0);
}

export async function openGoogleGalleryCardFlow(page: Page, { cancel = true } = {}) {
  await page.getByRole("button", { name: "Configure Google" }).click();
  await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Change" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Where do I find these?")).toBeVisible();
  await expect(page.getByRole("dialog").getByText(/Google Cloud Console/)).toBeVisible();
  if (cancel) {
    await page.getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeHidden({
      timeout: 10000,
    });
  }
}

export async function openEnterpriseGalleryCardFlow(
  page: Page,
  cardLabel: "Blocks OIDC" | "Bring your own SSO",
) {
  await enterpriseSection(page)
    .getByRole("button", { name: `Add ${cardLabel}`, exact: true })
    .click();
  await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Change" })).toBeVisible();
  await expect(page.getByRole("dialog").getByText(cardLabel, { exact: true })).toBeVisible();
  await expect(page.getByRole("dialog").getByText("Where do I find these?")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeHidden({
    timeout: 10000,
  });
}

export async function changeProviderPickFlow(page: Page) {
  await page.getByRole("dialog").getByRole("button", { name: "Change" }).click();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Change" })).toBeHidden();
  await expect(page.getByRole("dialog").getByText("Where do I find these?")).toBeHidden();
  // Provider Name is back to unset, matching the page-level "Add" button's blank dialog.
  await expect(page.getByRole("dialog").getByText("Select a provider")).toBeVisible();
}

export async function pickManualBlocksOidcHelpFlow(page: Page) {
  const providerTypeSelect = page.getByRole("dialog").getByRole("combobox").first();
  await providerTypeSelect.click();
  await page.getByRole("option", { name: "Blocks OIDC" }).click();
  await expect(page.getByRole("dialog").getByText("Where do I find these?")).toBeVisible();
  await expect(page.getByRole("dialog").getByRole("button", { name: "Change" })).toBeHidden();
  await expect(page.locator("#generatedWellKnownUrl")).toBeVisible();
}

export async function closeDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeHidden({
    timeout: 10000,
  });
}

export async function openAddIdentityProviderDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeVisible();
}

export async function verifyAddProviderDisabledFlow(page: Page) {
  const addButton = page.getByRole("button", { name: "Add Provider" });
  await expect(addButton).toBeDisabled();
}

export async function verifySocialProvidersOfferedFlow(page: Page) {
  const providerPickSelect = page.getByRole("dialog").getByRole("combobox").nth(1);
  await providerPickSelect.click();
  await expect(page.getByRole("option", { name: "Google" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Microsoft" })).toBeVisible();
  await page.keyboard.press("Escape");
}

export async function verifyBlocksOidcWellKnownUrlFlow(page: Page) {
  const providerTypeSelect = page.getByRole("dialog").getByRole("combobox").first();
  await providerTypeSelect.click();
  await page.getByRole("option", { name: "Blocks OIDC" }).click();

  const wellKnownInput = page.locator("#generatedWellKnownUrl");
  await expect(wellKnownInput).toBeVisible();
  await expect(wellKnownInput).toHaveAttribute("readonly", "");
  await expect(wellKnownInput).not.toHaveValue("");
}

export async function addAndRemoveRedirectUriRowFlow(page: Page) {
  await page.getByRole("button", { name: "Add Redirect URI" }).click();
  const uriInputs = page.getByPlaceholder("https://your-app.com/callback");
  await expect(uriInputs).toHaveCount(2);

  const secondRow = uriInputs.nth(1).locator("xpath=..");
  await secondRow.getByRole("button").click();
  await expect(uriInputs).toHaveCount(1);
}

export async function cancelIdentityProviderDialogFlow(page: Page) {
  await page
    .getByPlaceholder("https://your-app.com/callback")
    .fill("https://discarded.example.com");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeHidden({
    timeout: 10000,
  });
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeVisible();
  await expect(page.getByPlaceholder("https://your-app.com/callback")).toHaveValue("");
}

export async function createByosProviderFlow(
  page: Page,
  providerName: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
) {
  const providerTypeSelect = page.getByRole("dialog").getByRole("combobox").first();
  await providerTypeSelect.click();
  await page.getByRole("option", { name: "Bring your own SSO (BYOS)" }).click();

  await page.getByPlaceholder("my-identity-provider").fill(providerName);
  await page.getByPlaceholder("Enter client ID").fill(clientId);
  await page.getByPlaceholder("Enter client secret").fill(clientSecret);
  await page.getByPlaceholder("https://your-app.com/callback").fill(redirectUri);

  const addButton = page.getByRole("button", { name: "Add Provider" });
  await expect(addButton).toBeEnabled({ timeout: 10000 });
  await addButton.click();
  await expect(page.getByText("Identity provider created successfully").first()).toBeVisible({
    timeout: 15000,
  });
}

export async function reloadAndFindProviderRowFlow(page: Page, providerName: string) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Identity Provider" })).toBeVisible({
    timeout: 30000,
  });
  // Configured entries live inline in their type's gallery card, as a list.
  const providerRow = enterpriseSection(page)
    .getByRole("listitem")
    .filter({ hasText: providerName });
  await expect(providerRow).toBeVisible({ timeout: 15000 });
  return providerRow;
}

export async function expandProviderRowKvFlow(
  page: Page,
  providerRow: ReturnType<Page["getByRole"]>,
) {
  await providerRow.click();
  if (
    await page.getByText("Client Id").or(page.getByText("Client ID")).isVisible({ timeout: 10000 })
  ) {
    await expect(page.getByText("Client Id").or(page.getByText("Client ID"))).toBeVisible();
  }
}

export async function openEditIdentityProviderFlow(
  page: Page,
  providerRow: ReturnType<Page["getByRole"]>,
) {
  const editButton = providerRow.getByRole("button", { name: "Edit provider" });
  if (!(await editButton.isVisible({ timeout: 5000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: "Edit Identity Provider" })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole("dialog").getByRole("combobox").first()).toBeDisabled();
  await expect(page.getByPlaceholder("my-identity-provider")).toBeDisabled();
  await expect(page.getByPlaceholder("Enter client ID")).toBeDisabled();
  await expect(page.getByPlaceholder("••••••••••••")).toHaveValue("");
  await expect(page.getByRole("dialog").getByRole("button", { name: "Change" })).toBeHidden();
  await expect(page.getByRole("dialog").getByText("Where do I find these?")).toBeHidden();
  await page.getByRole("button", { name: "Cancel" }).click();
}

export async function disableAndReenableProviderFlow(
  page: Page,
  providerRow: ReturnType<Page["getByRole"]>,
) {
  const disableButton = providerRow.getByRole("button", { name: "Disable provider" });
  if (!(await disableButton.isVisible({ timeout: 5000 }))) return;
  await disableButton.click();
  await expect(page.getByRole("heading", { name: "Disable identity provider" })).toBeVisible();
  await page.getByRole("button", { name: "Disable", exact: true }).click();
  if (
    await page.getByText(/no longer be able to sign in|disabled/i).isVisible({ timeout: 10000 })
  ) {
    await expect(page.getByText(/no longer be able to sign in|disabled/i)).toBeVisible();
  }

  const enableButton = providerRow.getByRole("button", { name: "Enable provider" });
  if (!(await enableButton.isVisible({ timeout: 5000 }))) return;
  await enableButton.click();
  await expect(page.getByRole("heading", { name: "Enable identity provider" })).toBeVisible();
  await page.getByRole("button", { name: "Enable", exact: true }).click();
}

export async function deleteIdentityProviderFlow(
  page: Page,
  providerRow: ReturnType<Page["getByRole"]>,
) {
  const deleteButton = providerRow.getByRole("button", { name: "Delete provider" });
  if (!(await deleteButton.isVisible({ timeout: 5000 }))) return;
  await deleteButton.click();
  await expect(page.getByRole("heading", { name: "Delete identity provider" })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(providerRow).toHaveCount(0, { timeout: 15000 });
}

import { expect, type Locator, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

/** The dialog and the empty-state CTA share the name "Add provider", so every field lookup is scoped. */
const dialog = (page: Page): Locator => page.getByRole("dialog");

export async function navigateToExternalIdpFlow(page: Page) {
  await openSecretManagement(page, "external-idp", "External IdP");
}

export async function verifyEmptyStateFlow(page: Page) {
  const empty = page.getByText("No external IdP yet");
  if (!(await empty.isVisible({ timeout: 15000 }))) return;

  await expect(empty).toBeVisible();
  // The empty state has to carry its own call to action: with no provider configured there is
  // no list to hang one off, and the page header no longer offers one.
  await expect(page.getByRole("button", { name: "Add provider" })).toBeVisible();
}

export async function openAddProviderDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Add provider" }).first().click();
  await expect(dialog(page).getByRole("heading", { name: "Add provider" })).toBeVisible({
    timeout: 15000,
  });
}

export async function verifyRequiredFieldsRejectedFlow(page: Page) {
  const form = dialog(page);
  await form.getByRole("button", { name: "Add provider" }).click();

  await expect(form.getByText("Pick a provider")).toBeVisible({ timeout: 10000 });
  await expect(form.getByText(/Key is required/)).toBeVisible();
  await expect(form.getByText(/Issuer is required/)).toBeVisible();
}

async function selectOption(page: Page, triggerName: string, optionName: string) {
  await dialog(page).getByRole("combobox", { name: triggerName }).click();
  await page.getByRole("option", { name: optionName, exact: true }).click();
}

export async function verifyProvidersOfferedFlow(page: Page) {
  await dialog(page).getByRole("combobox", { name: "Provider" }).click();
  for (const name of ["Keycloak", "Okta", "Auth0", "Azure", "Others"]) {
    await expect(page.getByRole("option", { name, exact: true })).toBeVisible();
  }
  await page.keyboard.press("Escape");
}

/**
 * An HMAC algorithm stores a shared secret instead of fetching public keys, so the form must swap
 * the key source rather than show both — the backend rejects a provider carrying each one.
 */
export async function verifyKeySourceFollowsAlgorithmFlow(page: Page) {
  const form = dialog(page);
  await expect(form.getByLabel("JWKS URL")).toBeVisible();

  await selectOption(page, "Signing algorithm", "HS256");
  await expect(form.getByLabel("Signing secret")).toBeVisible();
  await expect(form.getByLabel("JWKS URL")).toBeHidden();

  await selectOption(page, "Signing algorithm", "RS256");
  await expect(form.getByLabel("JWKS URL")).toBeVisible();
  await expect(form.getByLabel("Signing secret")).toBeHidden();
}

export async function fillProviderFormFlow(
  page: Page,
  provider: { key: string; issuer: string; audience: string },
) {
  const form = dialog(page);
  await selectOption(page, "Provider", "Keycloak");
  await form.getByLabel("Key").fill(provider.key);
  await form.getByLabel("Issuer").fill(provider.issuer);
  await form.getByLabel("Audiences").fill(provider.audience);
  await form.getByLabel("JWKS URL").fill("https://www.googleapis.com/oauth2/v3/certs");
}

export async function verifyClaimMappingDefaultsFlow(page: Page) {
  const form = dialog(page);
  // userId is the one mapping without a safe fallback: every token collapses onto one principal
  // when it is missing, so the form pre-fills it.
  await expect(form.getByLabel("User ID")).toHaveValue("sub");
  await expect(form.getByLabel("Email")).toHaveValue("email");
}

export async function saveNewProviderFlow(page: Page) {
  await dialog(page).getByRole("button", { name: "Add provider" }).click();
  await expect(page.getByText("Provider added")).toBeVisible({ timeout: 20000 });
  await expect(dialog(page)).toBeHidden({ timeout: 10000 });
}

export async function verifyProviderCardFlow(
  page: Page,
  provider: { key: string; issuer: string; audience: string },
) {
  await expect(page.getByText(provider.key, { exact: true }).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(provider.issuer)).toBeVisible();
  await expect(page.getByText(provider.audience)).toBeVisible();
  await expect(page.getByText("https://www.googleapis.com/oauth2/v3/certs")).toBeVisible();
}

/** The integration card tells a caller whether x-blocks-idp is needed; a lone provider never needs it. */
export async function verifyApiIntegrationCardFlow(page: Page, key: string) {
  await expect(page.getByText("Calling the API with this provider's token")).toBeVisible();
  await expect(page.getByText("Header optional")).toBeVisible();
  await expect(page.getByText("x-blocks-idp", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy Header value" })).toBeVisible();
  await expect(page.getByText(key, { exact: true }).first()).toBeVisible();
}

export async function editProviderAndSaveFlow(page: Page, key: string, newIssuer: string) {
  await page.getByRole("button", { name: `Edit ${key}` }).click();
  await expect(dialog(page).getByRole("heading", { name: "Edit provider" })).toBeVisible();

  await dialog(page).getByLabel("Issuer").fill(newIssuer);
  await dialog(page).getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Provider updated")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(newIssuer)).toBeVisible({ timeout: 15000 });
}

export async function openEditProviderAndCloseFlow(page: Page, key: string) {
  await page.getByRole("button", { name: `Edit ${key}` }).click();
  await expect(dialog(page).getByRole("heading", { name: "Edit provider" })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toBeHidden({ timeout: 10000 });
}

export async function deleteProviderFlow(page: Page, key: string) {
  await page.getByRole("button", { name: `Delete ${key}` }).click();
  await expect(page.getByText(`Removed ${key}`)).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: `Delete ${key}` })).toBeHidden({ timeout: 15000 });
}

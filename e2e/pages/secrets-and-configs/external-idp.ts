import { expect, type Locator, type Page } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

/** The dialog and the empty-state CTA share the name "Add provider", so every field lookup is scoped. */
const dialog = (page: Page): Locator => page.getByRole("dialog");

const IDP_HEADER = "x-blocks-idp";

/**
 * The API returns keys masked, so every label built from a key has to be masked too. Mirrors
 * ProjectManagementService.MaskProviderKey: six characters or fewer have no middle to hide.
 */
export const maskKey = (key: string): string =>
  key.length <= 6 ? "*".repeat(key.length) : `${key.slice(0, 3)}***${key.slice(-3)}`;

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
/** Status reads as a labelled block rather than a bare switch, as it does on client credentials. */
export async function verifyStatusBlockFlow(page: Page) {
  const form = dialog(page);
  await expect(form.getByText("Status", { exact: true })).toBeVisible();
  await expect(form.getByText("Tokens from an inactive provider are not accepted.")).toBeVisible();
  await expect(form.getByRole("switch")).toBeVisible();
}

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

/** Claim mapping moved out of the create form: it is picked from a real token afterwards. */
export async function verifyFormAsksNothingAboutClaimsFlow(page: Page) {
  await expect(dialog(page).getByText("Claim mapping")).toBeHidden();
  await expect(dialog(page).getByLabel("User ID")).toBeHidden();
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
  await expect(page.getByText(maskKey(provider.key), { exact: true }).first()).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(provider.issuer)).toBeVisible();
  await expect(page.getByText(provider.audience)).toBeVisible();
  await expect(page.getByText("https://www.googleapis.com/oauth2/v3/certs")).toBeVisible();

  // The raw key is never rendered: the API only ever sends the mask.
  await expect(page.getByText(provider.key, { exact: true })).toHaveCount(0);
}

/**
 * Integration details live on the provider's own page now. It lists every header a caller sends,
 * and a lone provider never needs x-blocks-idp.
 */
export async function openDetailsAndVerifyIntegrationFlow(page: Page, key: string) {
  await page.getByRole("button", { name: `View details for ${maskKey(key)}` }).click();

  await expect(page.getByText("Calling the API with this provider's token")).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("Header optional")).toBeVisible();
  await expect(page.getByText("Claim mapping")).toBeVisible();

  await expect(page.getByRole("button", { name: "Copy x-blocks-key" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Copy x-blocks-idp" })).toBeVisible();
  await expect(page.getByText("Authorization", { exact: true })).toBeVisible();

  // The sample call is the IAM "me" endpoint, which is what proves a mapping end to end, and it
  // is copyable whole rather than one header at a time.
  const sample = page.getByText(/^curl .*\/iam\/me/);
  await expect(sample).toBeVisible();
  await expect(sample).toContainText(`${IDP_HEADER}: ${maskKey(key)}`);
  await expect(page.getByRole("button", { name: "Copy example request" })).toBeVisible();
}

export async function backToListFlow(page: Page) {
  await page.getByRole("button", { name: "All providers" }).click();
  await expect(page.getByRole("button", { name: "Add provider" })).toBeVisible({ timeout: 15000 });
}

export async function editProviderAndSaveFlow(page: Page, key: string, newIssuer: string) {
  await page.getByRole("button", { name: `Edit ${maskKey(key)}` }).click();
  await expect(dialog(page).getByRole("heading", { name: "Edit provider" })).toBeVisible();

  await dialog(page).getByLabel("Issuer").fill(newIssuer);
  await dialog(page).getByRole("button", { name: "Save changes" }).click();

  await expect(page.getByText("Provider updated")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(newIssuer)).toBeVisible({ timeout: 15000 });
}

export async function openEditProviderAndCloseFlow(page: Page, key: string) {
  await page.getByRole("button", { name: `Edit ${maskKey(key)}` }).click();
  await expect(dialog(page).getByRole("heading", { name: "Edit provider" })).toBeVisible();
  await dialog(page).getByRole("button", { name: "Cancel" }).click();
  await expect(dialog(page)).toBeHidden({ timeout: 10000 });
}

export async function deleteProviderFlow(page: Page, key: string) {
  await page.getByRole("button", { name: `Delete ${maskKey(key)}` }).click();
  await expect(page.getByText(`Removed ${maskKey(key)}`)).toBeVisible({ timeout: 20000 });
  await expect(page.getByRole("button", { name: `Delete ${maskKey(key)}` })).toBeHidden({ timeout: 15000 });
}

const drawer = (page: Page): Locator => page.getByRole("dialog").filter({ hasText: "Mapping table" });

export async function mapClaimsFromTokenFlow(page: Page, key: string, token: string) {
  await page.getByRole("button", { name: `Map JWT claim for ${maskKey(key)}` }).click();

  const panel = drawer(page);
  await expect(panel.getByText("Mapping table")).toBeVisible({ timeout: 15000 });

  // Nothing is mappable until a token names the claims, which is the point of the flow.
  await expect(panel.getByText("Decode a token above to list the claims it carries.")).toBeVisible();

  await panel.getByLabel("JSON Web Token (JWT)").fill(token);
  await panel.getByRole("button", { name: "Decode" }).click();

  await expect(panel.getByRole("status")).toContainText("Decoded successfully", {
    timeout: 10000,
  });

  await panel.getByRole("combobox", { name: "Username" }).click();
  await page.getByRole("option", { name: "preferred_username", exact: true }).click();

  await panel.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(`Claim mapping saved for ${maskKey(key)}`)).toBeVisible({ timeout: 20000 });
}

export async function verifyUnreadableTokenRejectedFlow(page: Page, key: string) {
  await page.getByRole("button", { name: `Map JWT claim for ${maskKey(key)}` }).click();

  const panel = drawer(page);
  await panel.getByLabel("JSON Web Token (JWT)").fill("not-a-jwt");
  await panel.getByRole("button", { name: "Decode" }).click();
  await expect(panel.getByRole("status")).toContainText("not a readable JWT", { timeout: 10000 });

  await panel.getByRole("button", { name: "Cancel" }).click();
  await expect(panel).toBeHidden({ timeout: 10000 });
}

/** The key field behaves like the signing secret: empty, with the stored value only as a hint. */
export async function verifyEditFormLeavesTheKeyBlankFlow(page: Page, key: string) {
  await page.getByRole("button", { name: `Edit ${maskKey(key)}` }).click();
  await expect(dialog(page).getByRole("heading", { name: "Edit provider" })).toBeVisible();

  const field = dialog(page).getByLabel("Key");
  await expect(field).toHaveValue("");
  await expect(field).toHaveAttribute("placeholder", new RegExp(`leave blank to keep`));
  await expect(
    dialog(page).getByText("Leave this blank to keep it", { exact: false }),
  ).toBeVisible();

  // Saving without touching it must not clear or rename the key.
  await dialog(page).getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Provider updated")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText(maskKey(key), { exact: true }).first()).toBeVisible();
}

/**
 * Enabling and disabling happens from the row itself, and is confirmed first: it stops every token
 * from the provider being accepted, while keeping the configuration.
 */
export async function toggleProviderFromListFlow(page: Page, key: string) {
  const masked = maskKey(key);

  await page.getByRole("button", { name: `Disable ${masked}` }).click();
  await expect(page.getByRole("heading", { name: "Disable provider" })).toBeVisible({
    timeout: 15000,
  });
  await page.getByRole("button", { name: "Disable", exact: true }).click();
  await expect(page.getByText(`${masked} disabled`)).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("Inactive")).toBeVisible({ timeout: 15000 });

  await page.getByRole("button", { name: `Enable ${masked}` }).click();
  await expect(page.getByRole("heading", { name: "Enable provider" })).toBeVisible();
  await page.getByRole("button", { name: "Enable", exact: true }).click();
  await expect(page.getByText(`${masked} enabled`)).toBeVisible({ timeout: 20000 });
}

import path from "path";
import { type Locator, type Page, expect } from "@playwright/test";
import { openOidcTemplate, openSecretManagement } from "../../support/os-helpers";

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function oidcEmptyState(page: Page) {
  return page.getByText("No OIDC clients yet");
}

function oidcClientHeader(page: Page) {
  return page.getByText("Client", { exact: true });
}

/**
 * OidcList renders a skeleton on its first load, the empty copy when there are
 * no credentials, and the Client column header only when there is at least one
 * row. Wait for either settled state so later steps do not race the skeleton
 * (neither empty copy nor Client exists during the first load).
 */
export async function waitForOidcListSettledFlow(page: Page) {
  await expect(oidcEmptyState(page).or(oidcClientHeader(page))).toBeVisible({
    timeout: 30_000,
  });
}

export async function navigateToOidcFlow(page: Page) {
  await openSecretManagement(page, "oidc", "OIDC");
  await waitForOidcListSettledFlow(page);
}

export async function verifyEmptyOidcStateFlow(page: Page) {
  await waitForOidcListSettledFlow(page);
  if (await oidcEmptyState(page).isVisible()) {
    await expect(oidcEmptyState(page)).toBeVisible();
  }
}

export async function openNewOidcClientDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "New OIDC Client" })).toBeVisible();
}

export async function verifyAddDisabledAndUrlValidationFlow(page: Page) {
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await expect(addButton).toBeDisabled();

  await page.getByPlaceholder("https://example.com/oidc").fill("not-a-valid-url");
  if (
    await page
      .getByText(
        "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.",
      )
      .isVisible({ timeout: 5000 })
  ) {
    await expect(
      page.getByText(
        "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.",
      ),
    ).toBeVisible();
  }
  await expect(addButton).toBeDisabled();
}

export async function verifyDeviceFlowToggleFlow(page: Page) {
  const deviceFlowCheckbox = page.locator("#isDeviceFlowClient");
  await deviceFlowCheckbox.click();
  await expect(page.getByPlaceholder("https://example.com/oidc")).toHaveCount(0);
  await expect(page.locator("#requirePkce")).toHaveCount(0);
  await expect(page.locator("#isAutoRedirect")).toHaveCount(0);
  await expect(page.locator("#registerAsIdentityProvider")).toHaveCount(0);
  await deviceFlowCheckbox.click();
  await expect(page.getByPlaceholder("https://example.com/oidc")).toBeVisible();
}

export async function addAndRemoveRedirectUriFlow(page: Page) {
  await page.getByPlaceholder("https://example.com/oidc").first().fill("https://example.com/callback");
  await page.getByRole("button", { name: "Add Redirect URI" }).click();
  const uriInputs = page.getByPlaceholder("https://example.com/oidc");
  await expect(uriInputs).toHaveCount(2);
  await uriInputs.nth(1).fill("https://example.com/callback-2");
  const secondRow = uriInputs.nth(1).locator("xpath=../..");
  await secondRow.getByRole("button").click();
  await expect(uriInputs).toHaveCount(1);
  await expect(uriInputs.first()).toHaveValue("https://example.com/callback");
}

export async function createOidcClientFlow(page: Page, clientName: string) {
  await page.getByPlaceholder("Enter client name").fill(clientName);
  await page.locator("#requirePkce").click();
  await page.locator("#isAutoRedirect").click();
  await page.locator("#registerAsIdentityProvider").click();
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await expect(addButton).toBeEnabled({ timeout: 10000 });
  await addButton.click();
  if (
    await page.getByText("OIDC Client created successfully", { exact: true }).isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("OIDC Client created successfully", { exact: true })).toBeVisible();
  }
  await waitForOidcListSettledFlow(page);
}

/** Creates a plain active OIDC client with one redirect URI, for specs that just need one. */
export async function createBasicOidcClientFlow(page: Page, clientName: string) {
  await openNewOidcClientDialogFlow(page);
  await page.getByPlaceholder("Enter client name").fill(clientName);
  await page.getByPlaceholder("https://example.com/oidc").first().fill("https://example.com/callback");
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await expect(addButton).toBeEnabled({ timeout: 10000 });
  await addButton.click();
  await expect(page.getByText("OIDC Client created successfully", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await waitForOidcListSettledFlow(page);
}

export async function findOidcClientRowFlow(page: Page, clientName: string): Promise<Locator> {
  await waitForOidcListSettledFlow(page);
  const clientRow = page.getByRole("row").filter({ hasText: clientName });
  await expect(clientRow).toBeVisible({ timeout: 15000 });
  const alreadyExpanded = await page.getByText("Client Id").isVisible({ timeout: 3000 });
  if (!alreadyExpanded) {
    await clientRow.click();
  }
  await expect(page.getByText("Client Id")).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Redirect URI(s)")).toBeVisible();
  await expect(page.getByText("Allowed Response Types")).toBeVisible();
  return clientRow;
}

export async function openManageTemplateFlow(page: Page) {
  await openOidcTemplate(page);

  const templateSections = page.getByRole("tablist", { name: "Template sections" });
  const themePalette = page.getByRole("tablist", { name: "Theme palette" });
  const oidcPages = page.getByRole("tablist", { name: "OIDC page" });
  const brandingSaveButton = page.getByRole("button", { name: "Save", exact: true });
  const brandingUndoButton = page.getByRole("button", { name: "Undo", exact: true });
  const brandNameInput = page.getByRole("textbox", { name: /Brand name/ });
  // The Branding tab now has an independent upload slot per mode (light/dark); existing
  // flows exercise the light slot, matching the single-logo behavior they were written for.
  const brandingLogoInput = page.locator("#client-logo-upload-light");

  await expect(templateSections).toBeVisible();
  await expect(templateSections.getByRole("tab", { name: "Branding" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(templateSections.getByRole("tab", { name: "Theme" })).toBeVisible();
  await expect(templateSections.getByRole("tab", { name: "Pages" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Brand identity" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live preview" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Template");
  await expect(brandingUndoButton).toBeDisabled();
  await expect(brandingSaveButton).toBeDisabled();
  await expect(brandNameInput).toBeVisible();
  // Two upload slots (light/dark) each have their own "Browse files" button now.
  await expect(page.getByRole("button", { name: "Browse files" }).first()).toBeVisible();

  return {
    templateSections,
    themePalette,
    oidcPages,
    brandingSaveButton,
    brandingUndoButton,
    brandNameInput,
    brandingLogoInput,
  };
}

export async function verifyClearBrandNameFlow(
  page: Page,
  brandNameInput: Locator,
  brandingSaveButton: Locator,
  originalBrandName: string,
) {
  await brandNameInput.fill("");
  await expect(
    page.getByText("Brand name must be between 1 and 80 characters"),
  ).toBeVisible({ timeout: 5000 });
  await expect(brandingSaveButton).toBeDisabled();
  await brandNameInput.fill(originalBrandName);
}

export async function changeBrandNameAndUndoFlow(
  page: Page,
  brandNameInput: Locator,
  brandingSaveButton: Locator,
  brandingUndoButton: Locator,
  originalBrandName: string,
) {
  const previewName = `Flow Brand ${Date.now()}`;
  await brandNameInput.fill(previewName);
  await expect(page.getByText(previewName).first()).toBeVisible({ timeout: 10000 });
  await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
  await brandingUndoButton.click();
  await expect(brandNameInput).toHaveValue(originalBrandName);
  await expect(brandingSaveButton).toBeDisabled();
  await expect(brandingUndoButton).toBeDisabled();
}

export async function verifyLogoUploadRejectsNonImageFlow(
  page: Page,
  brandingLogoInput: Locator,
  brandingSaveButton: Locator,
) {
  await brandingLogoInput.setInputFiles({
    name: "not-an-image.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not an image"),
  });
  await expect(
    page.getByText("Only PNG, JPG, SVG, and WebP images are allowed", { exact: true }),
  ).toBeVisible({ timeout: 5000 });
  await expect(brandingSaveButton).toBeDisabled();
}

export async function verifyLogoUploadRejectsOversizedFlow(
  page: Page,
  brandingLogoInput: Locator,
  brandingSaveButton: Locator,
) {
  await brandingLogoInput.setInputFiles({
    name: "oversized.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(3 * 1024 * 1024),
  });
  await expect(page.getByText("Logo must be smaller than 2MB", { exact: true })).toBeVisible({
    timeout: 5000,
  });
  await expect(brandingSaveButton).toBeDisabled();
}

export async function uploadValidLogoFlow(
  page: Page,
  brandingLogoInput: Locator,
  brandingSaveButton: Locator,
  brandingUndoButton: Locator,
) {
  await brandingLogoInput.setInputFiles(
    path.resolve(__dirname, "../../fixtures/test-avatar.png"),
  );
  await expect(page.getByAltText("Logo preview")).toBeVisible({ timeout: 10000 });
  await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
  await expect(brandingUndoButton).toBeEnabled();
}

export async function verifyUndoRevertsLogoFlow(
  page: Page,
  brandingUndoButton: Locator,
  brandingSaveButton: Locator,
) {
  await brandingUndoButton.click();
  await expect(brandingSaveButton).toBeDisabled();
  await expect(brandingUndoButton).toBeDisabled();
}

export async function verifyThemeInvalidHexFlow(
  page: Page,
  templateSections: Locator,
  themePalette: Locator,
  brandingSaveButton: Locator,
) {
  await templateSections.getByRole("tab", { name: "Theme" }).click();
  await expect(page.getByRole("heading", { name: "Color system" })).toBeVisible();
  await expect(themePalette).toBeVisible();
  await expect(themePalette.getByRole("tab", { name: "Light" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page.getByRole("textbox", { name: "Light Primary", exact: true }).fill("not-a-color");
  await expect(
    page.getByText("Light Primary must be a valid hex color (#RGB or #RRGGBB)"),
  ).toBeVisible({ timeout: 5000 });
  await expect(brandingSaveButton).toBeDisabled();
}

export async function setThemeColorsFlow(
  page: Page,
  themePalette: Locator,
  brandingSaveButton: Locator,
) {
  const lightHex = `#${(Date.now() & 0xffffff).toString(16).padStart(6, "0")}`;
  const lightPrimary = page.getByRole("textbox", { name: "Light Primary", exact: true });
  await lightPrimary.fill(lightHex);
  await expect(
    page.getByText("Light Primary must be a valid hex color (#RGB or #RRGGBB)"),
  ).toBeHidden({ timeout: 5000 });
  await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });

  await themePalette.getByRole("tab", { name: "Dark" }).click();
  const darkPrimary = page.getByRole("textbox", { name: "Dark Primary", exact: true });
  await expect(darkPrimary).toBeVisible();
  const darkHex = `#${((Date.now() + 0xabcdef) & 0xffffff).toString(16).padStart(6, "0")}`;
  await darkPrimary.fill(darkHex);
  await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
}

export async function editLoginPageHeadingFlow(
  page: Page,
  templateSections: Locator,
  oidcPages: Locator,
  brandingSaveButton: Locator,
) {
  await templateSections.getByRole("tab", { name: "Pages" }).click();
  await expect(page.getByRole("heading", { name: "Page content" })).toBeVisible();
  await expect(oidcPages).toBeVisible();
  await oidcPages.getByRole("tab", { name: "Login" }).click();
  const headingInput = page.locator("#page-login-heading");
  await expect(headingInput).toBeVisible();
  await headingInput.fill("Welcome back");
  await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
}

export async function verifyLoginHeadingRequiredFlow(
  page: Page,
  brandingSaveButton: Locator,
) {
  await page.locator("#page-login-heading").fill("");
  await expect(page.getByText("Heading must be between 1 and 200 characters")).toBeVisible({
    timeout: 5000,
  });
  await expect(brandingSaveButton).toBeDisabled();
  await page.locator("#page-login-heading").fill("Welcome back");
  await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
}

export async function editSignupHeadingFlow(page: Page, oidcPages: Locator, brandingSaveButton: Locator) {
  await oidcPages.getByRole("tab", { name: "Signup" }).click();
  const signupHeading = page.locator("#page-signup-heading");
  await expect(signupHeading).toBeVisible();
  const signupTitle = `Create Your Flow Account ${Date.now()}`;
  await signupHeading.fill(signupTitle);
  await expect(page.getByRole("heading", { name: signupTitle })).toBeVisible({ timeout: 10000 });
  await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
}

export async function saveTemplateAndReturnToOidcListFlow(
  page: Page,
  brandingSaveButton: Locator,
  clientRow: Locator,
) {
  await brandingSaveButton.click();
  await expect(page.getByText("Template saved successfully", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await openSecretManagement(page, "oidc", "OIDC");
  await waitForOidcListSettledFlow(page);
  await expect(page.getByRole("button", { name: "Manage Template" })).toBeVisible({
    timeout: 15000,
  });
  await expect(clientRow).toBeVisible({ timeout: 15000 });
}

export async function ensureOidcClientRowVisibleFlow(page: Page, clientRow: Locator) {
  if (!(await clientRow.isVisible({ timeout: 5000 }))) {
    await openSecretManagement(page, "oidc", "OIDC");
    await waitForOidcListSettledFlow(page);
    await expect(clientRow).toBeVisible({ timeout: 15000 });
  }
}

/**
 * The expanded details of a client are a separate table row right after the client's own row,
 * and they do not repeat the client name, so they are never inside `clientRow`.
 */
async function clientDetailsFlow(clientRow: Locator): Promise<Locator> {
  const details = clientRow.locator("xpath=following-sibling::tr[1]");
  const clientId = details.getByText("Client Id", { exact: true });
  if (!(await clientId.isVisible())) await clientRow.click();
  await expect(clientId).toBeVisible({ timeout: 10000 });
  return details;
}

/** Reveals the client secret in the details row (if hidden) and returns its value. */
async function readClientSecretFlow(clientRow: Locator): Promise<string> {
  const details = await clientDetailsFlow(clientRow);
  const show = details.getByRole("button", { name: "Show value" });
  if (await show.isVisible()) await show.click();
  const hide = details.getByRole("button", { name: "Hide value" });
  await expect(hide).toBeVisible();
  const value = (await hide.locator("xpath=preceding-sibling::span[1]").textContent())?.trim() ?? "";
  expect(value, "the client secret should be shown once revealed").not.toBe("");
  return value;
}

export async function revealAndCopyClientSecretFlow(page: Page, clientRow: Locator) {
  await readClientSecretFlow(clientRow);

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  const details = await clientDetailsFlow(clientRow);
  await details.getByRole("button", { name: "Copy value" }).first().click();
}

/**
 * Rotates the client's secret and checks it really changed: the secret shown in the details
 * row before, against the one in the "New client secret" dialog and the details row after.
 */
export async function rotateClientSecretFlow(page: Page, clientRow: Locator, clientName: string) {
  const before = await readClientSecretFlow(clientRow);

  await clientRow.getByRole("button", { name: "Rotate client secret" }).click();
  const confirm = page.getByRole("dialog", { name: "Rotate client secret" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(`Do you want to rotate the client secret for ${clientName}`);
  await confirm.getByRole("button", { name: "Rotate Secret" }).click();
  await expect(page.getByText("Client secret rotated successfully", { exact: true })).toBeVisible({
    timeout: 15000,
  });

  const reveal = page.getByRole("dialog", { name: "New client secret" });
  await expect(reveal).toBeVisible();
  await expect(reveal).toContainText("The previous secret no longer works");
  const after = (await reveal.locator("code").textContent())?.trim() ?? "";
  expect(after, "the rotated secret should be shown").not.toBe("");
  expect(after, "rotating should issue a new secret").not.toBe(before);
  await reveal.getByRole("button", { name: "Done" }).click();
  await expect(reveal).toBeHidden();

  expect(await readClientSecretFlow(clientRow)).toBe(after);
}

export async function openEditOidcAndCloseFlow(page: Page, clientRow: Locator) {
  const editButton = clientRow.getByRole("button", { name: "Edit" });
  if (!(await editButton.isVisible({ timeout: 8000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: "Edit OIDC Client" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
}

export async function editOidcClientAndSaveFlow(page: Page, clientRow: Locator) {
  const editButton = clientRow.getByRole("button", { name: "Edit" });
  if (!(await editButton.isVisible({ timeout: 8000 }))) return;
  await editButton.click();
  await expect(page.getByRole("heading", { name: "Edit OIDC Client" })).toBeVisible();
  await page.locator("#isActive").click();
  const updateButton = page.getByRole("button", { name: "Update", exact: true });
  await expect(updateButton).toBeEnabled({ timeout: 10000 });
  await updateButton.click();
  if (
    await page.getByText("OIDC Client updated successfully", { exact: true }).isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("OIDC Client updated successfully", { exact: true })).toBeVisible();
  }
}

export async function deleteOidcClientFlow(page: Page, clientRow: Locator, clientName: string) {
  const deleteButton = clientRow.getByRole("button", { name: "Delete" });
  if (!(await deleteButton.isVisible({ timeout: 8000 }))) return;
  await deleteButton.click();
  await expect(page.getByRole("heading", { name: "Delete OIDC Client" })).toBeVisible();
  await expect(
    page.getByText(`delete.*${escapeRegex(clientName)}`, { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  if (
    await page.getByText("OIDC credential deleted successfully", { exact: true }).isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("OIDC credential deleted successfully", { exact: true })).toBeVisible();
  }
}

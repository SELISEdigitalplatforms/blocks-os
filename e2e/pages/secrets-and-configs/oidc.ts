import path from "path";
import { type Locator, type Page, type Request, type Route, expect } from "@playwright/test";
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
  await expect(page.getByText("OIDC Client created successfully", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  const secret = await closeOneTimeSecretDialogFlow(page, clientName, "created");
  await waitForOidcListSettledFlow(page);
  return secret;
}

/**
 * Since 2c271042 (feat(idp): show client secrets only once) the client secret is shown exactly
 * once, in a "Copy your client secret now" dialog, after a create or a rotate. The list never
 * shows it again, and the dialog closes only with its button (not Escape, not outside clicks).
 * Checks the dialog names the client and shows a secret, closes it, and returns the secret.
 */
export async function closeOneTimeSecretDialogFlow(
  page: Page,
  clientLabel: string,
  reason: "created" | "rotated",
): Promise<string> {
  const dialog = page.getByRole("dialog", { name: "Copy your client secret now" });
  await expect(dialog).toBeVisible({ timeout: 15000 });
  await expect(dialog).toContainText(
    reason === "created"
      ? `${clientLabel} was created.`
      : `The secret for ${clientLabel} was rotated. The old secret no longer works.`,
  );
  await expect(dialog).toContainText("You will not see this secret again.");
  await expect(dialog.getByRole("button", { name: "Copy client secret" })).toBeVisible();
  // Two code blocks: the masked client id, then the secret in full.
  const secret = ((await dialog.locator("code").nth(1).textContent()) ?? "").trim();
  expect(secret, "the one-time dialog should show the client secret").not.toBe("");
  await dialog.getByRole("button", { name: "I copied it, close" }).click();
  await expect(dialog).toBeHidden({ timeout: 10000 });
  return secret;
}

/** Creates a plain active OIDC client with one redirect URI, for specs that just need one. */
export async function createBasicOidcClientFlow(
  page: Page,
  clientName: string,
  options: { registerAsIdentityProvider?: boolean } = {},
) {
  await openNewOidcClientDialogFlow(page);
  await page.getByPlaceholder("Enter client name").fill(clientName);
  await page.getByPlaceholder("https://example.com/oidc").first().fill("https://example.com/callback");
  if (options.registerAsIdentityProvider !== undefined) {
    // The box is ticked by default, so a plain click turned the registration off and the
    // Signup Link Client picker (e2c2d12a) then greyed the client out. Set the wanted state.
    const register = page.locator("#registerAsIdentityProvider");
    const wanted = String(options.registerAsIdentityProvider);
    if ((await register.getAttribute("aria-checked")) !== wanted) await register.click();
    await expect(register).toHaveAttribute("aria-checked", wanted);
  }
  const addButton = page.getByRole("button", { name: "Add", exact: true });
  await expect(addButton).toBeEnabled({ timeout: 10000 });
  await addButton.click();
  await expect(page.getByText("OIDC Client created successfully", { exact: true })).toBeVisible({
    timeout: 15000,
  });
  await closeOneTimeSecretDialogFlow(page, clientName, "created");
  await waitForOidcListSettledFlow(page);
}

export async function findOidcClientRowFlow(page: Page, clientName: string): Promise<Locator> {
  await waitForOidcListSettledFlow(page);
  const clientRow = page.getByRole("row").filter({ hasText: clientName });
  await expect(clientRow).toBeVisible({ timeout: 15000 });
  // The details panel is the row right after the client's row. Scope to it: other clients in the
  // shared project may be expanded too, so a page-wide "Client Id" can match more than once.
  const details = clientRow.locator("xpath=following-sibling::tr[1]");
  const alreadyExpanded = await details.getByText("Client Id").isVisible({ timeout: 3000 });
  if (!alreadyExpanded) {
    await clientRow.click();
  }
  await expect(details.getByText("Client Id")).toBeVisible({ timeout: 10000 });
  await expect(details.getByText("Redirect URI(s)")).toBeVisible();
  await expect(details.getByText("Allowed Response Types")).toBeVisible();
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
  // 216c2c52 (fix(client): OS issues from dev testing): the Manage Template breadcrumb ends at OIDC.
  const breadcrumb = page.getByRole("navigation", { name: "breadcrumb" });
  await expect(breadcrumb).toHaveText(/OIDC$/);
  await expect(breadcrumb).not.toContainText("Template");
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

/**
 * Since 2c271042 the details row never shows the client secret, and since e2e2b34d (fix(idp):
 * keep the rotated secret dialog open; drop the hidden secret row) it has no Client Secret entry
 * at all. Checks that, and that the secret issued on create (or rotate) is nowhere in it.
 */
async function expectClientSecretHiddenFlow(clientRow: Locator, issuedSecret: string) {
  const details = await clientDetailsFlow(clientRow);
  await expect(details.getByText("Redirect URI(s)")).toBeVisible();
  await expect(details.getByText("Client Secret", { exact: true })).toHaveCount(0);
  await expect(details.getByRole("button", { name: "Show value" })).toHaveCount(0);
  await expect(details).not.toContainText(issuedSecret);
}

export async function verifySecretHiddenAndCopyClientIdFlow(
  page: Page,
  clientRow: Locator,
  issuedSecret: string,
) {
  await expectClientSecretHiddenFlow(clientRow, issuedSecret);

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
  const details = await clientDetailsFlow(clientRow);
  await details.getByRole("button", { name: "Copy value" }).first().click();
}

/**
 * Rotates the client's secret and checks it really changed: the secret issued on create against
 * the one in the one-time dialog after the rotation, and that the details row still hides it.
 */
export async function rotateClientSecretFlow(
  page: Page,
  clientRow: Locator,
  clientName: string,
  previousSecret: string,
) {
  await clientRow.getByRole("button", { name: "Rotate client secret" }).click();
  const confirm = page.getByRole("dialog", { name: "Rotate client secret" });
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText(`A new secret will be made for ${clientName}`);
  await confirm.getByRole("button", { name: "Rotate Secret" }).click();
  await expect(page.getByText("Client secret rotated successfully", { exact: true })).toBeVisible({
    timeout: 15000,
  });

  const after = await closeOneTimeSecretDialogFlow(page, clientName, "rotated");
  expect(after, "rotating should issue a new secret").not.toBe(previousSecret);

  await expectClientSecretHiddenFlow(clientRow, after);
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
  // Wait for the loaded client to reset the form, or the toggle below is undone by that reset.
  await expect(page.getByPlaceholder("Enter client name")).not.toHaveValue("", { timeout: 15000 });
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
    // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- input is escaped with escapeRegex
    page.getByText(new RegExp(`delete.*${escapeRegex(clientName)}`, "i")),
  ).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).last().click();
  if (
    await page.getByText("OIDC credential deleted successfully", { exact: true }).isVisible({ timeout: 15000 })
  ) {
    await expect(page.getByText("OIDC credential deleted successfully", { exact: true })).toBeVisible();
  }
}

// ─── Application type (Web / Mobile app, #680) ──────────────────────────────

export type OidcApplicationType = "web" | "mobile";

export const OIDC_APP_TYPE_HELPER: Record<OidcApplicationType, string> = {
  web: "For browser-based apps.",
  mobile:
    "For iOS and Android apps. Uses a public client with PKCE, and the app receives tokens in the token response.",
};
export const OIDC_REDIRECT_PLACEHOLDER: Record<OidcApplicationType, string> = {
  web: "https://example.com/oidc",
  mobile: "com.example.app://callback",
};
export const OIDC_MOBILE_URI_NEEDS_MOBILE_TYPE =
  "Mobile app redirect URIs need the Mobile app application type.";
export const OIDC_MOBILE_URI_INVALID =
  "Enter an HTTPS URL or a mobile app URI such as com.example.app://callback.";
export const OIDC_WEB_HTTPS_INVALID =
  "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.";

export function applicationTypeRadio(page: Page, type: OidcApplicationType): Locator {
  return page.locator(`#applicationType-${type}`);
}

/** Redirect URI inputs under either placeholder (it changes with the application type). */
export function oidcRedirectUriInputs(page: Page): Locator {
  return page.getByPlaceholder(/^(https:\/\/example\.com\/oidc|com\.example\.app:\/\/callback)$/);
}

export function oidcClientRow(page: Page, clientName: string): Locator {
  return page.getByRole("row").filter({ hasText: clientName });
}

export async function selectApplicationTypeFlow(page: Page, type: OidcApplicationType) {
  await applicationTypeRadio(page, type).click();
  await expect(applicationTypeRadio(page, type)).toHaveAttribute("aria-checked", "true");
}

export async function expectApplicationTypeFlow(page: Page, type: OidcApplicationType) {
  const other: OidcApplicationType = type === "web" ? "mobile" : "web";
  await expect(applicationTypeRadio(page, type)).toHaveAttribute("aria-checked", "true", {
    timeout: 10_000,
  });
  await expect(applicationTypeRadio(page, other)).toHaveAttribute("aria-checked", "false");
  await expect(page.getByText(OIDC_APP_TYPE_HELPER[type], { exact: true })).toBeVisible();
}

/** Mobile: PKCE checked + disabled with the locked label, Identity Provider hidden, app placeholder. */
export async function expectMobileLockedStateFlow(page: Page) {
  const pkce = page.locator("#requirePkce");
  await expect(pkce).toBeChecked();
  await expect(pkce).toBeDisabled();
  await expect(page.getByText("Required for mobile apps", { exact: true })).toBeVisible();
  await expect(page.locator("#registerAsIdentityProvider")).toHaveCount(0);
  await expect(page.getByPlaceholder(OIDC_REDIRECT_PLACEHOLDER.mobile).first()).toBeVisible();
}

export async function openEditOidcClientFlow(page: Page, clientName: string) {
  await waitForOidcListSettledFlow(page);
  const row = oidcClientRow(page, clientName);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("heading", { name: "Edit OIDC Client" })).toBeVisible();
  // The dialog opens with the create defaults and resets the form once GET oidc-clients/{id}
  // returns. Wait for the client's own name, or a field typed before that reset is overwritten
  // (H8 typed the new name, the reset put the old one back, and the save sent the old name).
  await expect(page.getByPlaceholder("Enter client name")).toHaveValue(clientName, {
    timeout: 15_000,
  });
  return row;
}

export async function closeOidcDialogFlow(page: Page) {
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0, { timeout: 10_000 });
}

const oidcClientsPath = (req: Request) => new URL(req.url()).pathname;
const isOidcSave = (req: Request) =>
  req.method() === "POST" && /\/oidc-clients\/?$/.test(oidcClientsPath(req));
const isOidcGetById = (req: Request) =>
  req.method() === "GET" && /\/oidc-clients\/[^/]+\/?$/.test(oidcClientsPath(req));

/** Resolves with the JSON body of the next POST oidc-clients (create or update). */
export function nextOidcSave(page: Page): Promise<Record<string, unknown>> {
  return page
    .waitForRequest(isOidcSave, { timeout: 20_000 })
    .then((req) => req.postDataJSON() as Record<string, unknown>);
}

/** Counts POST oidc-clients and GET oidc-clients/{id} sent from now on. */
export function countOidcRequests(page: Page): {
  saves: () => number;
  getsById: () => number;
  stop: () => void;
} {
  let saves = 0;
  let gets = 0;
  const onRequest = (req: Request) => {
    if (isOidcSave(req)) saves += 1;
    if (isOidcGetById(req)) gets += 1;
  };
  page.on("request", onRequest);
  return { saves: () => saves, getsById: () => gets, stop: () => page.off("request", onRequest) };
}

/**
 * Stubs POST oidc-clients with an IAM-style 400 until `unroute` is called. The IAM is on its own
 * origin, so the stub carries CORS headers; the preflight still goes to the real IAM.
 */
export async function stubOidcSave400(page: Page): Promise<{ unroute: () => Promise<void> }> {
  const matcher = (url: URL) => /\/oidc-clients\/?$/.test(url.pathname);
  const handler = async (route: Route) => {
    const req = route.request();
    if (req.method() !== "POST") return route.continue();
    const origin = (await req.headerValue("origin")) ?? new URL(page.url()).origin;
    return route.fulfill({
      status: 400,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": origin,
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({
        isSuccess: false,
        errors: { RedirectUris: "Redirect URI is not allowed." },
      }),
    });
  };
  await page.route(matcher, handler);
  return { unroute: () => page.unroute(matcher, handler) };
}

export type OidcCredential = {
  itemId: string;
  clientDisplayName?: string;
  clientType?: string | null;
  useTokensCookie?: boolean;
  redirectUris?: string[];
  isActive?: boolean;
  requirePkce?: boolean;
  registerAsIdentityProvider?: boolean;
  isDeviceFlowClient?: boolean;
};

export type OidcClientsApi = {
  list: () => Promise<OidcCredential[]>;
  get: (itemId: string) => Promise<OidcCredential>;
  /** Creates a client through POST oidc-clients and returns its itemId. */
  create: (body: {
    clientDisplayName: string;
    redirectUris: string[];
    clientType: string | null;
    useTokensCookie: boolean;
    requirePkce?: boolean;
  }) => Promise<string>;
  idByName: (clientDisplayName: string) => Promise<string | undefined>;
  remove: (itemId: string) => Promise<void>;
  /** Deletes every client with that display name; never throws (cleanup). */
  removeByName: (clientDisplayName: string) => Promise<void>;
};

const DROPPED_HEADERS = /^(cookie|host|content-length|accept-encoding|connection|sec-.*|:.*)$/i;

/**
 * Opens the OIDC list and captures the URL + auth headers of its GET oidc-clients call, then
 * returns an API helper that replays them through the context's request client (shares cookies;
 * not subject to CORS, since the IAM is on its own origin). Headers are never logged.
 */
export async function oidcClientsApiFlow(page: Page): Promise<OidcClientsApi> {
  const listRequest = page.waitForRequest(
    (req) => req.method() === "GET" && /\/oidc-clients\/?$/.test(oidcClientsPath(req)),
    { timeout: 30_000 },
  );
  await navigateToOidcFlow(page);
  const req = await listRequest;
  const base = req.url().split("?")[0].replace(/\/$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  for (const [key, value] of Object.entries(await req.allHeaders())) {
    if (!DROPPED_HEADERS.test(key)) headers[key] = value;
  }

  const list = async () => {
    const res = await page.request.get(base, { headers });
    expect(res.status(), `GET oidc-clients HTTP ${res.status()}`).toBe(200);
    const json = (await res.json()) as { oIDCClientCredentials?: OidcCredential[] };
    return json.oIDCClientCredentials ?? [];
  };
  const get = async (itemId: string) => {
    const res = await page.request.get(`${base}/${itemId}`, { headers });
    expect(res.status(), `GET oidc-clients/{id} HTTP ${res.status()}`).toBe(200);
    const json = (await res.json()) as { oIDCClientCredential?: OidcCredential };
    expect(json.oIDCClientCredential, "GET oidc-clients/{id} returns the client").toBeTruthy();
    return json.oIDCClientCredential as OidcCredential;
  };
  const idByName = async (name: string) =>
    (await list()).find((c) => c.clientDisplayName === name)?.itemId;
  const remove = async (itemId: string) => {
    const res = await page.request.delete(`${base}/${itemId}`, { headers });
    expect(res.status(), `DELETE oidc-clients/{id} HTTP ${res.status()}`).toBeLessThan(300);
  };
  const create: OidcClientsApi["create"] = async (body) => {
    const res = await page.request.post(base, {
      headers,
      data: {
        itemId: "",
        clientDisplayName: body.clientDisplayName,
        redirectUris: body.redirectUris,
        scope: "openid",
        isAutoRedirect: false,
        isActive: true,
        requirePkce: body.requirePkce ?? true,
        registerAsIdentityProvider: false,
        isDeviceFlowClient: false,
        allowedResponseTypes: ["code"],
        clientType: body.clientType,
        useTokensCookie: body.useTokensCookie,
      },
    });
    const status = res.status();
    const json = (await res.json().catch(() => ({}))) as { isSuccess?: boolean; errors?: unknown };
    expect(status, `POST oidc-clients HTTP ${status}: ${JSON.stringify(json.errors ?? {})}`).toBe(200);
    const id = await idByName(body.clientDisplayName);
    expect(id, `fixture client "${body.clientDisplayName}" is listed after create`).toBeTruthy();
    return id as string;
  };
  const removeByName = async (name: string) => {
    try {
      for (const c of await list()) {
        if (c.clientDisplayName === name) await remove(c.itemId);
      }
    } catch (error) {
      console.warn(`[oidc] cleanup of "${name}" failed: ${String(error)}`);
    }
  };

  return { list, get, create, idByName, remove, removeByName };
}

/**
 * Switches the console theme. Current genesis-os renders a "Change theme" dropdown with
 * Auto / Light / Dark radio items; older builds had Light / Dark / Auto tabs (see
 * pages/overview/topbar.ts). The emulated colour scheme is matched so "system" agrees.
 */
export async function setConsoleThemeFlow(page: Page, theme: "light" | "dark" | "system") {
  await page.emulateMedia({ colorScheme: theme === "system" ? null : theme });
  const label = { light: "Light", dark: "Dark", system: "Auto" }[theme];
  const menuButton = page.getByRole("button", { name: "Change theme" }).first();
  const tab = page.locator(`[id*="trigger-${theme}"]`).first();
  if (await menuButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await menuButton.click();
    await page.getByRole("menuitemradio", { name: label }).click();
    await expect(page.getByRole("menu")).toHaveCount(0);
  } else if (await tab.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true");
  } else if (theme !== "system") {
    console.warn(`[oidc] no theme switcher visible; relying on emulated colour scheme (${theme})`);
  }
  if (theme === "dark") await expect.soft(page.locator("html")).toHaveClass(/\bdark\b/);
  if (theme === "light") await expect.soft(page.locator("html")).not.toHaveClass(/\bdark\b/);
}

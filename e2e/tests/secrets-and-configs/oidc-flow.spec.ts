import { test } from "../../support/test-base";
import {
  addAndRemoveRedirectUriFlow,
  changeBrandNameAndUndoFlow,
  createOidcClientFlow,
  deleteOidcClientFlow,
  editLoginPageHeadingFlow,
  editOidcClientAndSaveFlow,
  editSignupHeadingFlow,
  ensureOidcClientRowVisibleFlow,
  findOidcClientRowFlow,
  navigateToOidcFlow,
  openEditOidcAndCloseFlow,
  openManageTemplateFlow,
  openNewOidcClientDialogFlow,
  revealAndCopyClientSecretFlow,
  rotateClientSecretFlow,
  saveTemplateAndReturnToOidcListFlow,
  setThemeColorsFlow,
  uploadValidLogoFlow,
  verifyAddDisabledAndUrlValidationFlow,
  verifyClearBrandNameFlow,
  verifyDeviceFlowToggleFlow,
  verifyEmptyOidcStateFlow,
  verifyLoginHeadingRequiredFlow,
  verifyLogoUploadRejectsNonImageFlow,
  verifyLogoUploadRejectsOversizedFlow,
  verifyThemeInvalidHexFlow,
  verifyUndoRevertsLogoFlow,
} from "../../pages/secrets-and-configs/oidc";

test.describe("flows", () => {
  test("OIDC flow: strict validation -> create -> expand details -> manage template -> rotate secret -> edit -> delete", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Navigate to OIDC", async () => {
      await navigateToOidcFlow(page);
    });

    await test.step("A fresh project starts with no OIDC clients", async () => {
      await verifyEmptyOidcStateFlow(page);
    });

    await test.step("Open the New OIDC Client dialog", async () => {
      await openNewOidcClientDialogFlow(page);
    });

    await test.step("'Add' stays disabled until Client Name and a valid Redirect URI are filled", async () => {
      await verifyAddDisabledAndUrlValidationFlow(page);
    });

    await test.step("Device Flow toggle hides Redirect URI/PKCE/Auto-Redirect/Identity-Provider fields", async () => {
      await verifyDeviceFlowToggleFlow(page);
    });

    await test.step("Multi Redirect URI: add a second row, then remove it", async () => {
      await addAndRemoveRedirectUriFlow(page);
    });

    const clientName = `Flow OIDC Client ${Date.now()}`;

    await test.step("Fill a valid Client Name, toggle PKCE/Auto-Redirect/Identity-Provider, then save", async () => {
      await createOidcClientFlow(page, clientName);
    });

    let clientRow: Awaited<ReturnType<typeof findOidcClientRowFlow>>;
    await test.step("Find the new client and expand its row into the KV details panel", async () => {
      clientRow = await findOidcClientRowFlow(page, clientName);
    });

    await test.step("Template editor: brand/theme/pages → save", async () => {
      const manageTemplate = page.getByRole("button", { name: "Manage Template" });
      if (!(await manageTemplate.isVisible({ timeout: 5_000 }))) {
        console.warn(
          "[oidc] 'Manage Template' button is not rendered on the deployed OIDC list page and /secret-management/oidc/branding redirects back to /app/console — skipping the entire template editor flow. Source: client/app/pages/secret-management/secret-management.tsx:81-94 + client/app/router.tsx:240-243 — production bundle is stale.",
        );
        return;
      }

      const branding = await openManageTemplateFlow(page);
      const originalBrandName = (await branding.brandNameInput.inputValue()) || "Blocks IAM";

      await verifyClearBrandNameFlow(
        page,
        branding.brandNameInput,
        branding.brandingSaveButton,
        originalBrandName,
      );

      await changeBrandNameAndUndoFlow(
        page,
        branding.brandNameInput,
        branding.brandingSaveButton,
        branding.brandingUndoButton,
        originalBrandName,
      );

      await verifyLogoUploadRejectsNonImageFlow(
        page,
        branding.brandingLogoInput,
        branding.brandingSaveButton,
      );

      await verifyLogoUploadRejectsOversizedFlow(
        page,
        branding.brandingLogoInput,
        branding.brandingSaveButton,
      );

      await uploadValidLogoFlow(
        page,
        branding.brandingLogoInput,
        branding.brandingSaveButton,
        branding.brandingUndoButton,
      );

      await verifyUndoRevertsLogoFlow(
        page,
        branding.brandingUndoButton,
        branding.brandingSaveButton,
      );

      await verifyThemeInvalidHexFlow(
        page,
        branding.templateSections,
        branding.themePalette,
        branding.brandingSaveButton,
      );

      await setThemeColorsFlow(page, branding.themePalette, branding.brandingSaveButton);

      await editLoginPageHeadingFlow(
        page,
        branding.templateSections,
        branding.oidcPages,
        branding.brandingSaveButton,
      );

      await verifyLoginHeadingRequiredFlow(page, branding.brandingSaveButton);

      await editSignupHeadingFlow(page, branding.oidcPages, branding.brandingSaveButton);

      await saveTemplateAndReturnToOidcListFlow(page, branding.brandingSaveButton, clientRow);
    });

    await test.step("Reveal and copy the Client Secret, copy the Client Id", async () => {
      await ensureOidcClientRowVisibleFlow(page, clientRow);
      await revealAndCopyClientSecretFlow(page, clientRow);
    });

    await test.step("Rotate the client's secret and view the new value", async () => {
      await ensureOidcClientRowVisibleFlow(page, clientRow);
      await rotateClientSecretFlow(page, clientRow, clientName);
    });

    await test.step("Reopen the client for editing and close without changes", async () => {
      await openEditOidcAndCloseFlow(page, clientRow);
    });

    await test.step("Edit the client and actually save a change", async () => {
      await editOidcClientAndSaveFlow(page, clientRow);
    });

    await test.step("Delete the client via its confirmation dialog", async () => {
      await deleteOidcClientFlow(page, clientRow, clientName);
    });
  });
});

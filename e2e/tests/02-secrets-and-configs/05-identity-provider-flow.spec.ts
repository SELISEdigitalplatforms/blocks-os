import { test } from "../../support/test-base";
import {
  addAndRemoveRedirectUriRowFlow,
  cancelIdentityProviderDialogFlow,
  changeProviderPickFlow,
  closeDialogFlow,
  createByosProviderFlow,
  deleteIdentityProviderFlow,
  disableAndReenableProviderFlow,
  expandProviderRowKvFlow,
  navigateToIdentityProvidersFlow,
  openAddIdentityProviderDialogFlow,
  openEditIdentityProviderFlow,
  openEnterpriseGalleryCardFlow,
  openGoogleGalleryCardFlow,
  pickManualBlocksOidcHelpFlow,
  reloadAndFindProviderRowFlow,
  verifyAddProviderDisabledFlow,
  verifyBlocksOidcWellKnownUrlFlow,
  verifyEmptyStateFlow,
  verifySocialProvidersOfferedFlow,
} from "../../pages/secrets-and-configs/identity-providers";

test.describe("flows", () => {
  test("Identity Provider flow: create -> new provider appears in the list", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Identity Provider", async () => {
      await navigateToIdentityProvidersFlow(page);
    });

    await test.step("A fresh project starts with the empty-state gallery", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("Clicking the Google gallery card opens the dialog with a pre-fill banner and help", async () => {
      await openGoogleGalleryCardFlow(page, { cancel: false });
    });

    await test.step("Change clears the banner/help and resets to the blank dialog state", async () => {
      await changeProviderPickFlow(page);
    });

    await test.step("Manually picking Blocks OIDC shows its help box without a banner", async () => {
      await pickManualBlocksOidcHelpFlow(page);
    });

    await test.step("Close this dialog", async () => {
      await closeDialogFlow(page);
    });

    await test.step("Clicking the Blocks OIDC gallery card opens a blank add dialog preset to it, with its own banner/help", async () => {
      await openEnterpriseGalleryCardFlow(page, "Blocks OIDC");
    });

    await test.step("Reopening the Blocks OIDC gallery card shows the banner again (not permanently dismissed)", async () => {
      await openEnterpriseGalleryCardFlow(page, "Blocks OIDC");
    });

    await test.step("Open the Add Identity Provider dialog", async () => {
      await openAddIdentityProviderDialogFlow(page);
    });

    await test.step("'Add Provider' stays disabled until the form is valid", async () => {
      await verifyAddProviderDisabledFlow(page);
    });

    await test.step("Social provider type shows a provider Select (Google/Microsoft)", async () => {
      await verifySocialProvidersOfferedFlow(page);
    });

    await test.step("Blocks OIDC type shows an auto-generated, read-only Well Known URL", async () => {
      await verifyBlocksOidcWellKnownUrlFlow(page);
    });

    await test.step("Redirect URI: add and remove extra rows", async () => {
      await addAndRemoveRedirectUriRowFlow(page);
    });

    await test.step("Cancel discards entered data", async () => {
      await cancelIdentityProviderDialogFlow(page);
    });

    const providerName = `flow-idp-${Date.now()}`;

    await test.step("Switch to BYOS, fill the form, and save", async () => {
      await createByosProviderFlow(
        page,
        providerName,
        `flow-client-id-${Date.now()}`,
        "flow-client-secret-value",
        "https://example.com/callback",
      );
    });

    let providerRow: ReturnType<typeof page.getByRole>;
    await test.step("Reload and find the new provider row", async () => {
      providerRow = await reloadAndFindProviderRowFlow(page, providerName);
    });

    await test.step("Expand the row to see its KV details", async () => {
      await expandProviderRowKvFlow(page, providerRow);
    });

    await test.step("Edit the provider: Provider Type/Name/Client ID are locked, Secret is blank", async () => {
      await openEditIdentityProviderFlow(page, providerRow);
    });

    await test.step("Disable then re-enable the provider via its status action", async () => {
      await disableAndReenableProviderFlow(page, providerRow);
    });

    await test.step("Delete the provider via its confirmation dialog", async () => {
      await deleteIdentityProviderFlow(page, providerRow);
    });
  });
});

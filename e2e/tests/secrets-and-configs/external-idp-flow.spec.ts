import { test } from "../../support/test-base";
import {
  editProviderAndSaveFlow,
  navigateToExternalIdpFlow,
  openAddOrEditProviderDialogFlow,
  openEditProviderAndCloseFlow,
  saveValidJwksFlow,
  verifyEmptyStateFlow,
  verifyInvalidJwksRejectedFlow,
  verifyJwksUrlRequiredFlow,
  verifyProvidersOfferedFlow,
  verifySaveDisabledFlow,
  verifySummaryCardFlow,
} from "../../pages/secrets-and-configs/external-idp";

test.describe("flows", () => {
  test("External IdP flow: empty state -> strict validation -> create -> view -> edit", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to External IdP", async () => {
      await navigateToExternalIdpFlow(page);
    });

    await test.step("Empty state is shown before any provider is configured", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("Open the Add/Edit provider dialog", async () => {
      await openAddOrEditProviderDialogFlow(page);
    });

    await test.step("'Save' stays disabled until the form is dirty", async () => {
      await verifySaveDisabledFlow(page);
    });

    await test.step("Provider offers Keycloak, Okta, Auth0, Azure, and Others", async () => {
      await verifyProvidersOfferedFlow(page);
    });

    await test.step("Strict validation: JWKS URL is required", async () => {
      await verifyJwksUrlRequiredFlow(page);
    });

    await test.step("Strict validation: an unreachable/invalid JWKS URL is rejected", async () => {
      await verifyInvalidJwksRejectedFlow(page);
    });

    const issuerValue = `https://example.com/issuer-${Date.now()}`;

    await test.step("Fill a valid JWKS URL for the default Keycloak provider and save", async () => {
      await saveValidJwksFlow(page, issuerValue);
    });

    await test.step("The saved configuration renders as a read-only summary card", async () => {
      await verifySummaryCardFlow(page, issuerValue);
    });

    await test.step("Reopen the provider for editing and close without changes", async () => {
      await openEditProviderAndCloseFlow(page);
    });

    await test.step("Edit the provider and actually save the change", async () => {
      await editProviderAndSaveFlow(page, "https://example.com/issuer-updated");
    });
  });
});

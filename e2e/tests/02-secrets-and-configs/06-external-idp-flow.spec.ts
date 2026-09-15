import { test } from "../../support/test-base";
import {
  deleteProviderFlow,
  editProviderAndSaveFlow,
  fillProviderFormFlow,
  navigateToExternalIdpFlow,
  openAddProviderDialogFlow,
  openEditProviderAndCloseFlow,
  saveNewProviderFlow,
  verifyApiIntegrationCardFlow,
  verifyClaimMappingDefaultsFlow,
  verifyEmptyStateFlow,
  verifyKeySourceFollowsAlgorithmFlow,
  verifyProviderCardFlow,
  verifyProvidersOfferedFlow,
  verifyRequiredFieldsRejectedFlow,
} from "../../pages/secrets-and-configs/external-idp";

test.describe("flows", () => {
  test("External IdP flow: empty state -> validation -> create -> view -> edit -> delete", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const suffix = Date.now();
    const provider = {
      key: `flow-idp-${suffix}`,
      issuer: `https://example.com/issuer-${suffix}`,
      audience: `https://example.com/api-${suffix}`,
    };

    await test.step("Navigate to External IdP", async () => {
      await navigateToExternalIdpFlow(page);
    });

    await test.step("Empty state offers the only way to add the first provider", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("Open the Add provider dialog", async () => {
      await openAddProviderDialogFlow(page);
    });

    await test.step("Saving an empty form reports every required field", async () => {
      await verifyRequiredFieldsRejectedFlow(page);
    });

    await test.step("Provider offers Keycloak, Okta, Auth0, Azure, and Others", async () => {
      await verifyProvidersOfferedFlow(page);
    });

    await test.step("The key source follows the signing algorithm", async () => {
      await verifyKeySourceFollowsAlgorithmFlow(page);
    });

    await test.step("Claim mapping starts from sensible defaults", async () => {
      await verifyClaimMappingDefaultsFlow(page);
    });

    await test.step("Fill and save a valid asymmetric provider", async () => {
      await fillProviderFormFlow(page, provider);
      await saveNewProviderFlow(page);
    });

    await test.step("The saved provider renders as a summary card", async () => {
      await verifyProviderCardFlow(page, provider);
    });

    await test.step("The integration card explains how callers reach this provider", async () => {
      await verifyApiIntegrationCardFlow(page, provider.key);
    });

    await test.step("Reopen the provider for editing and close without changes", async () => {
      await openEditProviderAndCloseFlow(page, provider.key);
    });

    await test.step("Edit the provider and actually save the change", async () => {
      await editProviderAndSaveFlow(page, provider.key, `https://example.com/issuer-${suffix}-v2`);
    });

    await test.step("Delete the provider, which is what revokes it", async () => {
      await deleteProviderFlow(page, provider.key);
    });
  });
});

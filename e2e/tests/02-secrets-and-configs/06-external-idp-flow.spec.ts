import { test } from "../../support/test-base";
import {
  deleteProviderFlow,
  editProviderAndSaveFlow,
  fillProviderFormFlow,
  navigateToExternalIdpFlow,
  openAddProviderDialogFlow,
  openEditProviderAndCloseFlow,
  saveNewProviderFlow,
  openDetailsAndVerifyIntegrationFlow,
  backToListFlow,
  verifyEditFormLeavesTheKeyBlankFlow,
  verifyFormAsksNothingAboutClaimsFlow,
  verifyEmptyStateFlow,
  verifyKeySourceFollowsAlgorithmFlow,
  verifyProviderCardFlow,
  verifyProvidersOfferedFlow,
  verifyRequiredFieldsRejectedFlow,
  verifyStatusBlockFlow,
  toggleProviderFromListFlow,
  verifyUnreadableTokenRejectedFlow,
  mapClaimsFromTokenFlow,
} from "../../pages/secrets-and-configs/external-idp";

/** Payload-only sample: the drawer decodes without verifying, since it reads claim names alone. */
const SAMPLE_TOKEN = [
  "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9",
  "eyJzdWIiOiJ1c2VyLTEiLCJlbWFpbCI6ImFAYi5jIiwicHJlZmVycmVkX3VzZXJuYW1lIjoicmFmZWVuIn0",
  "signature",
].join(".");

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

    await test.step("Status is a labelled block, not a bare switch", async () => {
      await verifyStatusBlockFlow(page);
    });

    await test.step("The key source follows the signing algorithm", async () => {
      await verifyKeySourceFollowsAlgorithmFlow(page);
    });

    await test.step("The create form asks nothing about claims", async () => {
      await verifyFormAsksNothingAboutClaimsFlow(page);
    });

    await test.step("Fill and save a valid asymmetric provider", async () => {
      await fillProviderFormFlow(page, provider);
      await saveNewProviderFlow(page);
    });

    await test.step("The saved provider renders as a summary card", async () => {
      await verifyProviderCardFlow(page, provider);
    });

    await test.step("The details page lists every header a caller has to send", async () => {
      await openDetailsAndVerifyIntegrationFlow(page, provider.key);
      await backToListFlow(page);
    });

    await test.step("The edit form leaves the key blank and keeps it when untouched", async () => {
      await verifyEditFormLeavesTheKeyBlankFlow(page, provider.key);
    });

    await test.step("An unreadable token is reported rather than silently ignored", async () => {
      await verifyUnreadableTokenRejectedFlow(page, provider.key);
    });

    await test.step("Map claims by decoding a token the provider would issue", async () => {
      await mapClaimsFromTokenFlow(page, provider.key, SAMPLE_TOKEN);
    });

    await test.step("Reopen the provider for editing and close without changes", async () => {
      await openEditProviderAndCloseFlow(page, provider.key);
    });

    await test.step("Edit the provider and actually save the change", async () => {
      await editProviderAndSaveFlow(page, provider.key, `https://example.com/issuer-${suffix}-v2`);
    });

    await test.step("Disable and re-enable the provider from its row", async () => {
      await toggleProviderFromListFlow(page, provider.key);
    });

    await test.step("Delete the provider, which is what revokes it", async () => {
      await deleteProviderFlow(page, provider.key);
    });
  });
});

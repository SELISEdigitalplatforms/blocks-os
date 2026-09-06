import { test } from "../../support/test-base";
import {
  assignPermissionFlow,
  assignRoleFlow,
  cancelClientCredentialDialogFlow,
  fillClientNameFlow,
  navigateToClientCredentialsFlow,
  openAddClientCredentialDialogFlow,
  openClientForEditFlow,
  saveClientCredentialFlow,
  seedTestRoleFlow,
  verifyAccessTokenLifetimeClampedFlow,
  verifyClientNameValidationFlow,
  verifyEmptyPermissionsStateFlow,
  verifyEmptyStateFlow,
} from "../../pages/secrets-and-configs/client-credentials";

test.describe("flows", () => {
  test.fail(
    true,
    "Client Credentials can never be created through the UI on a fresh project — Permissions is a required field (min 1, see createClientSchema in create-client-credential/utils.ts) but the Assign Permissions picker has no permissions to offer, and creating a custom permission to seed one is itself a confirmed broken flow (identity-and-access/permissions-flow.spec.ts: saving a new permission never succeeds). This leaves the Add button permanently disabled, so no client credential can be saved. Once permission creation is fixed, this test.fail() should be removed.",
  );

  test("Client Credentials flow: strict validation -> create -> open for edit", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Seed a role via IAM", async () => {
      await seedTestRoleFlow(page);
    });

    await test.step("Navigate to Client Credentials", async () => {
      await navigateToClientCredentialsFlow(page);
    });

    await test.step("A fresh project starts with no client credentials", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("Open the Add Client Credential dialog", async () => {
      await openAddClientCredentialDialogFlow(page);
    });

    await test.step("Strict validation: Client Name is required and length-bound", async () => {
      await verifyClientNameValidationFlow(page);
    });

    await test.step("Access Token Lifetime is clamped to the 5-120 minute range", async () => {
      await verifyAccessTokenLifetimeClampedFlow(page);
    });

    await test.step("Permissions section shows its own empty state", async () => {
      await verifyEmptyPermissionsStateFlow(page);
    });

    await test.step("Cancel discards entered data", async () => {
      await cancelClientCredentialDialogFlow(page);
    });

    const clientName = `Flow Client ${Date.now()}`;

    await test.step("Fill Client Name", async () => {
      await fillClientNameFlow(page, clientName);
    });

    await test.step("Assign a role via the picker", async () => {
      await assignRoleFlow(page);
    });

    await test.step("Assign a permission via the picker", async () => {
      await assignPermissionFlow(page);
    });

    await test.step("Save the client credential", async () => {
      await saveClientCredentialFlow(page);
    });

    await test.step("Find the new client and reopen it for editing", async () => {
      await openClientForEditFlow(page, clientName);
    });
  });
});

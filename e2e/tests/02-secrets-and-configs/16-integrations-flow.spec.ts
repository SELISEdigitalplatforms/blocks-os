import { test } from "../../support/test-base";
import {
  clearConnectionNameFlow,
  createConnectionFlow,
  disconnectConnectionFlow,
  hasAccessTemplates,
  navigateToIntegrationsFlow,
  openAddConnectionDialogFlow,
  regenerateSecretFlow,
  selectTemplateAndFillNameFlow,
  verifyConnectionListedFlow,
  verifyCreateDisabledWithoutSelectionFlow,
  verifyEmptyStateFlow,
} from "../../pages/secrets-and-configs/integrations";

// Integrations flow: empty state -> Add connection dialog (access-level radio
// gate) -> create (role + client credential via the IAM setup calls) -> the
// one-time secret dialog -> the connection row with its badges and actions ->
// regenerate secret -> disconnect. Disconnect revokes the credential and the
// row stays listed as "revoked", so a kept project tolerates reruns.
test.describe("flows", () => {
  test("Integrations flow: empty state -> add connection -> secret dialog -> row details -> regenerate -> disconnect", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    const connectionName = `Flow Integration ${Date.now()}`;

    await test.step("Navigate to Integrations", async () => {
      await navigateToIntegrationsFlow(page);
    });

    await test.step("A fresh project starts with no connections", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("'Add connection' opens the setup dialog with access options", async () => {
      await openAddConnectionDialogFlow(page);
    });

    let canCreate = false;
    await test.step("Access options are available on this environment", async () => {
      canCreate = await hasAccessTemplates(page);
    });

    if (!canCreate) {
      await test.step("No access options — closing the dialog and finishing early", async () => {
        await page.keyboard.press("Escape");
      });
      return;
    }

    await test.step("'Create connection' stays disabled without a selection and name", async () => {
      await verifyCreateDisabledWithoutSelectionFlow(page);
    });

    await test.step(`Select the first access template and name the connection "${connectionName}"`, async () => {
      await selectTemplateAndFillNameFlow(page, connectionName);
    });

    await test.step("Clearing the name disables Create again", async () => {
      await clearConnectionNameFlow(page);
      await selectTemplateAndFillNameFlow(page, connectionName);
    });

    await test.step("Create the connection (and read the one-time secret when shown)", async () => {
      await createConnectionFlow(page);
    });

    await test.step("The connection row lists badges, details and actions", async () => {
      await verifyConnectionListedFlow(page, connectionName);
    });

    await test.step("Regenerate issues a new secret and keeps the row", async () => {
      await regenerateSecretFlow(page, connectionName);
    });

    await test.step("Disconnect revokes the credential and keeps the row listed", async () => {
      await disconnectConnectionFlow(page, connectionName);
    });
  });
});

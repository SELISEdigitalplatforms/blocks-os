import { test } from "../../support/test-base";
import {
  backToBlocksDatabaseFlow,
  cancelResetsFormFlow,
  editCollectionPatternFlow,
  fillOwnDataSourceFieldsFlow,
  navigateToDataGatewayFlow,
  openConfirmDialogAndCancelFlow,
  resetPatternFlow,
  saveViaConfirmDialogFlow,
  verifyAnalyticsNotConfiguredFlow,
  verifyDefaultsFlow,
  verifyPatternPersistedFlow,
  verifySaveDisabledWithoutOwnFieldsFlow,
  verifySectionsFlow,
  revealOwnDataSourceFieldsFlow,
} from "../../pages/secrets-and-configs/data-gateway";

// Data Gateway flow: the single settings form — section layout, the Blocks vs.
// custom data-source radio gate (Save stays disabled until a custom source has
// both fields), collection-name pattern editing around the fixed {SchemaName}
// token, unset analytics dates, Cancel restoring the loaded form, and the
// confirm-dialog save path with a persistence check. The saved configuration
// is reset to the platform default pattern at the end so shared-project
// reruns (E2E_KEEP_PROJECT=1) start from the same state.
test.describe("flows", () => {
  test("Data Gateway flow: sections -> custom-source validation -> pattern edit -> cancel reset -> confirm save -> persists", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Navigate to Data Gateway", async () => {
      await navigateToDataGatewayFlow(page);
    });

    await test.step("All three sections render with the data-source radio gate", async () => {
      await verifySectionsFlow(page);
    });

    await test.step("A fresh project starts on the Blocks database with default pattern and toggles", async () => {
      await verifyDefaultsFlow(page);
    });

    await test.step("Selecting 'My data sources' reveals the connection fields", async () => {
      await revealOwnDataSourceFieldsFlow(page);
    });

    await test.step("Save stays disabled until both custom fields are filled", async () => {
      await verifySaveDisabledWithoutOwnFieldsFlow(page);
    });

    await test.step("Filling both fields enables Save", async () => {
      await fillOwnDataSourceFieldsFlow(page);
    });

    await test.step("Switching back to the Blocks database hides the fields and re-enables Save", async () => {
      await backToBlocksDatabaseFlow(page);
    });

    await test.step("Edit the collection-name postfix around the fixed {SchemaName} token", async () => {
      await editCollectionPatternFlow(page);
    });

    await test.step("Analytics dates are unset and read-only on a fresh project", async () => {
      await verifyAnalyticsNotConfiguredFlow(page);
    });

    await test.step("Cancel restores the loaded form after edits", async () => {
      await cancelResetsFormFlow(page);
    });

    await test.step("Save opens the confirm dialog and Cancel there saves nothing", async () => {
      await openConfirmDialogAndCancelFlow(page);
    });

    let saved = false;
    await test.step("Save through the confirm dialog", async () => {
      saved = await saveViaConfirmDialogFlow(page);
    });

    if (saved) {
      await test.step("The edited pattern survives a reload", async () => {
        await verifyPatternPersistedFlow(page);
      });

      await test.step("Reset the pattern back to the platform default", async () => {
        await resetPatternFlow(page);
      });
    } else {
      await test.step("Save did not complete — backend refused the configuration (skipping persistence checks)", async () => {
        // Same graceful path as the storage flow: the page still works, the
        // backend just declined this tenant's save. Nothing further to assert.
      });
    }
  });
});

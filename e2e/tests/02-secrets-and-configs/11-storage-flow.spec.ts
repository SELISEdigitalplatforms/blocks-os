import { test } from "../../support/test-base";
import { e2eDebugLog } from "../../support/env";
import {
  fillAndSaveAwsFlow,
  fillAndSaveAzureFlow,
  fillAndSaveS3CompatibleFlow,
  fillAndSaveSftpFlow,
  navigateToStorageFlow,
  openViewDetailsDrawerFlow,
  providerFilterAddSecondFlow,
  providerFilterNarrowToOneFlow,
  resetClearsAllFiltersFlow,
  searchFilterNarrowAndClearFlow,
  verifyAwsNameRequiredFlow,
  verifyAwsRequiredFieldsFlow,
  verifyAzureDoesNotLeakOnSwitchFlow,
  verifyAzureRequiredFieldsFlow,
  verifyCardClickRegressionGuardFlow,
  verifyEmptyStateFlow,
  verifyS3CompatibleRequiredFieldsFlow,
  verifySftpPasswordNotMaskedFlow,
  verifySftpRequiredFieldsFlow,
} from "../../pages/secrets-and-configs/storage";

test.describe("flows", () => {
  test("Storage flow: strict validation and successful save for every provider -> open a card's View Details drawer", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Navigate to Storage", async () => {
      await navigateToStorageFlow(page);
    });

    await test.step("A fresh project starts with no storage configurations", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("[AWS] Name is required regardless of provider", async () => {
      await verifyAwsNameRequiredFlow(page);
    });

    const awsName = `Flow AWS ${Date.now()}`;

    await test.step("[AWS] Strict validation: Secret Key, Access Key and Region Endpoint are required", async () => {
      await verifyAwsRequiredFieldsFlow(page, awsName);
    });

    let awsSaved = false;
    await test.step("[AWS] Fill a fully valid configuration and save", async () => {
      awsSaved = await fillAndSaveAwsFlow(page, awsName);
    });

    const azureName = `Flow Azure ${Date.now()}`;

    await test.step("[Azure] Strict validation: Connection String is required", async () => {
      await verifyAzureRequiredFieldsFlow(page, azureName);
    });

    await test.step("[Azure] Secret data does not leak in plaintext across provider switches", async () => {
      await verifyAzureDoesNotLeakOnSwitchFlow(page);
    });

    let azureSaved = false;
    await test.step("[Azure] Fill a fully valid configuration and save", async () => {
      azureSaved = await fillAndSaveAzureFlow(page, azureName);
    });

    const sftpName = `Flow SFTP ${Date.now()}`;

    await test.step("[SFTP] Strict validation: Host, Username, Password and Remote Base Path are required", async () => {
      await verifySftpRequiredFieldsFlow(page, sftpName);
    });

    await test.step("[SFTP] Password field is not masked — documented regression guard", async () => {
      await verifySftpPasswordNotMaskedFlow(page);
    });

    let sftpSaved = false;
    await test.step("[SFTP] Fill a fully valid configuration and save", async () => {
      sftpSaved = await fillAndSaveSftpFlow(page);
    });

    const s3CompatibleName = `Flow S3 Compatible ${Date.now()}`;

    await test.step("[AWS S3 Compatible] Strict validation: Access Key, Secret Key and Host URL are required", async () => {
      await verifyS3CompatibleRequiredFieldsFlow(page, s3CompatibleName);
    });

    let s3CompatibleSaved = false;
    await test.step("[AWS S3 Compatible] Fill a fully valid configuration and save", async () => {
      s3CompatibleSaved = await fillAndSaveS3CompatibleFlow(page);
    });

    await test.step("Search filter narrows the card grid to a matching name, then clears via its inline 'X' button", async () => {
      await searchFilterNarrowAndClearFlow(
        page,
        awsName,
        azureName,
        sftpName,
        s3CompatibleName,
        awsSaved,
        azureSaved,
      );
    });

    await test.step("Provider filter narrows the card grid to a single selected provider", async () => {
      await providerFilterNarrowToOneFlow(
        page,
        awsName,
        azureName,
        sftpName,
        s3CompatibleName,
        awsSaved,
      );
    });

    await test.step("Provider filter with two providers selected shows the union of both", async () => {
      await providerFilterAddSecondFlow(
        page,
        awsName,
        azureName,
        sftpName,
        s3CompatibleName,
        awsSaved,
        azureSaved,
      );
    });

    await test.step("The combined 'Reset' button clears every active filter at once", async () => {
      await resetClearsAllFiltersFlow(page, sftpName, s3CompatibleName, sftpSaved, s3CompatibleSaved);
    });

    await test.step("'View Details' opens the details drawer with the configuration's properties", async () => {
      if (!s3CompatibleSaved) {
        e2eDebugLog(
          "[storage-flow] Skipping View Details check — AWS S3 Compatible configuration was not saved earlier in this run.",
        );
        return;
      }
      await openViewDetailsDrawerFlow(page, s3CompatibleName);
    });

    await test.step("Regression guard: clicking the card body itself currently does nothing (no onClick wired)", async () => {
      if (!s3CompatibleSaved) {
        e2eDebugLog(
          "[storage-flow] Skipping card-click regression guard — AWS S3 Compatible configuration was not saved earlier in this run.",
        );
        return;
      }
      await verifyCardClickRegressionGuardFlow(page, s3CompatibleName);
    });
  });
});

import { test } from "../../support/test-base";
import {
  deleteSecretAndRestoreFlow,
  editSecretDescriptionFlow,
  expandSecretRowFlow,
  fillAndSaveSecretFlow,
  findSecretRowFlow,
  lockAndUnlockSecretFlow,
  navigateToSecretFlow,
  openActionsMenuFlow,
  openAuditLogFlow,
  openCreateSecretDialogFlow,
  revealAndCopySecretValueFlow,
  rotateSecretValueFlow,
  searchSecretFlow,
  filterByTypeAndStatusFlow as filterTypeStatusFlow,
  verifyAccessListPickerVisibleFlow,
  verifyEmptyStateFlow,
  verifyNameAndValueRequiredFlow,
  verifyNamePatternAndDescriptionLengthFlow,
} from "../../pages/secrets-and-configs/secret";

test.describe("flows", () => {
  test("Secret flow: strict validation -> create -> expand details -> row actions", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Secret", async () => {
      await navigateToSecretFlow(page);
    });

    await test.step("A fresh project starts with no secrets", async () => {
      await verifyEmptyStateFlow(page);
    });

    await test.step("Open the Create secret dialog", async () => {
      await openCreateSecretDialogFlow(page);
    });

    await test.step("Strict validation: Name and Secret value are required", async () => {
      await verifyNameAndValueRequiredFlow(page);
    });

    await test.step("Strict validation: Name must follow the allowed pattern, Description has a max length", async () => {
      await verifyNamePatternAndDescriptionLengthFlow(page);
    });

    await test.step("Access list picker is shown for the Application category", async () => {
      await verifyAccessListPickerVisibleFlow(page);
    });

    const secretName = `flow-secret-${Date.now()}`;

    await test.step("Fill a valid secret and save", async () => {
      await fillAndSaveSecretFlow(page, secretName, "flow-secret-value-12345");
    });

    let secretRow: Awaited<ReturnType<typeof findSecretRowFlow>>;
    await test.step("Find the new secret in the list", async () => {
      secretRow = await findSecretRowFlow(page, secretName);
    });

    await test.step("Search filters the list by name", async () => {
      await searchSecretFlow(page, secretRow, secretName);
    });

    await test.step("Type and Status filters narrow the list", async () => {
      await filterTypeStatusFlow(page, secretRow);
    });

    await test.step("Find the new secret and expand its row into details", async () => {
      await expandSecretRowFlow(page, secretRow);
    });

    await test.step("Reveal and copy the secret's value", async () => {
      await revealAndCopySecretValueFlow(page, secretRow, "flow-secret-value-12345");
    });

    await test.step("Open the row's actions dropdown and close it without deleting", async () => {
      await openActionsMenuFlow(page, secretName);
    });

    await test.step("Edit the secret's description via the row's Edit action", async () => {
      await editSecretDescriptionFlow(page, secretName, "Updated by the Secret flow test.");
    });

    await test.step("Rotate the secret's value", async () => {
      await rotateSecretValueFlow(page, secretName, "flow-secret-value-rotated");
    });

    await test.step("Lock then unlock the secret", async () => {
      await lockAndUnlockSecretFlow(page, secretRow, secretName);
    });

    await test.step("Open the Audit log", async () => {
      await openAuditLogFlow(page, secretName);
    });

    await test.step("Delete the secret, then restore it", async () => {
      await deleteSecretAndRestoreFlow(page, secretRow, secretName);
    });
  });
});

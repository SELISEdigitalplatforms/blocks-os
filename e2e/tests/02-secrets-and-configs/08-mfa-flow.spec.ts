import { test } from "../../support/test-base";
import {
  cancelMfaConfirmationFlow,
  getMfaRowFlow,
  navigateToMfaFlow,
  readMfaStatusFlow,
  toggleAndConfirmMfaFlow,
  verifyBothMfaMethodsVisibleFlow,
  verifyMfaStatusFlow,
} from "../../pages/secrets-and-configs/mfa";

test.describe("flows", () => {
  test("MFA flow: view methods -> enable -> disable", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to MFA", async () => {
      await navigateToMfaFlow(page);
    });

    const emailRow = await test.step("Locate Email MFA row", async () => {
      return await getMfaRowFlow(page, "Email");
    });
    const authenticatorRow = await test.step("Locate Authenticator MFA row", async () => {
      return await getMfaRowFlow(page, "Authenticator app");
    });

    await test.step("The fixed MFA method table shows Email and Authenticator app", async () => {
      await verifyBothMfaMethodsVisibleFlow(page, emailRow, authenticatorRow);
    });

    const initialEmailStatus = await readMfaStatusFlow(emailRow);
    const initialAuthenticatorStatus = await readMfaStatusFlow(authenticatorRow);

    await test.step("Cancel on the confirmation dialog leaves status unchanged", async () => {
      await cancelMfaConfirmationFlow(page, emailRow, initialEmailStatus);
    });

    await test.step("Toggle Email MFA to the opposite of its current state", async () => {
      const nextAction = initialEmailStatus === "Enabled" ? "Disable" : "Enable";
      await toggleAndConfirmMfaFlow(page, emailRow, "Email", nextAction);
      await verifyMfaStatusFlow(emailRow, nextAction === "Enable" ? "Enabled" : "Disabled");
    });

    await test.step("Toggle Authenticator app MFA to the opposite of its current state", async () => {
      const nextAction = initialAuthenticatorStatus === "Enabled" ? "Disable" : "Enable";
      await toggleAndConfirmMfaFlow(page, authenticatorRow, "Authenticator app", nextAction);
      await verifyMfaStatusFlow(authenticatorRow, nextAction === "Enable" ? "Enabled" : "Disabled");
    });

    await test.step("Toggle Authenticator app MFA back to its original state", async () => {
      const restoreAction = initialAuthenticatorStatus === "Enabled" ? "Enable" : "Disable";
      await toggleAndConfirmMfaFlow(page, authenticatorRow, "Authenticator app", restoreAction);
      await verifyMfaStatusFlow(authenticatorRow, initialAuthenticatorStatus as "Enabled" | "Disabled");
    });

    await test.step("Toggle Email MFA back to its original state", async () => {
      const restoreAction = initialEmailStatus === "Enabled" ? "Enable" : "Disable";
      await toggleAndConfirmMfaFlow(page, emailRow, "Email", restoreAction);
      await verifyMfaStatusFlow(emailRow, initialEmailStatus as "Enabled" | "Disabled");
    });
  });
});

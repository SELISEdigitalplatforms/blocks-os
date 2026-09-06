import { test } from "../../support/test-base";
import {
  navigateToSettingsFlow,
  switchSettingsTabFlow,
  lockoutValidationFlow,
  resetDiscardsEditFlow,
  saveValidAuthSettingFlow,
  certificateActionsPresentFlow,
  toggleOidcHidesPathsFlow,
  toggleLogoutAndEditRegexFlow,
  enableSignupAndAssignRolesFlow,
  cancelMultiOrgConfirmationFlow,
  confirmMultiOrgFlow,
  mobileTabsSwitchFlow,
} from "../../pages/identity-and-access/settings";

// Settings flow: the default Auth tab, strict numeric validation, a valid
// save, then a walk across the IAM / Signup / Organization tabs.
test.describe("flows", () => {
  test("Settings flow: Auth tab strict validation -> save -> IAM/Signup/Organization tabs", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Settings (renders as Auth Configuration)", async () => {
      await navigateToSettingsFlow(page);
    });

    await test.step("Strict validation: a non-positive value is rejected", async () => {
      await lockoutValidationFlow(page);
    });

    await test.step("Reset discards an edited Token Configuration field", async () => {
      await resetDiscardsEditFlow(page);
    });

    await test.step("A valid value enables Save, and saving shows a success toast", async () => {
      await saveValidAuthSettingFlow(page);
    });

    await test.step("Certificate 'Copy' and 'Download' actions are present in Infrastructure", async () => {
      await certificateActionsPresentFlow(page);
    });

    await test.step("Navigate to the IAM tab", async () => {
      await switchSettingsTabFlow(page, "IAM");
    });

    await test.step("OIDC toggle hides the Activation & Recovery Paths fields, then Reset restores them", async () => {
      await toggleOidcHidesPathsFlow(page);
    });

    await test.step("Toggle 'Logout on Password Change', edit the strength regex, and save", async () => {
      await toggleLogoutAndEditRegexFlow(page);
    });

    await test.step("Navigate to the Signup tab", async () => {
      await switchSettingsTabFlow(page, "Signup");
    });

    await test.step("Enable Sign Up, assign a default role and permission, then save", async () => {
      await enableSignupAndAssignRolesFlow(page);
    });

    await test.step("Navigate to the Organization tab", async () => {
      await switchSettingsTabFlow(page, "Organization");
    });

    await test.step("Cancelling the enable-multi-org confirmation leaves it off", async () => {
      await cancelMultiOrgConfirmationFlow(page);
    });

    await test.step("Confirming enables multi-org and reveals the Creation Workflows card", async () => {
      await confirmMultiOrgFlow(page);
    });

    await test.step("Switch tabs via the mobile Select dropdown", async () => {
      await mobileTabsSwitchFlow(page);
    });
  });
});

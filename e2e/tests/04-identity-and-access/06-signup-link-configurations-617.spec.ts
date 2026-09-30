import { expect } from "@playwright/test";
import { test } from "../../support/test-base";
import {
  archiveConfigurationFlow,
  clientSideRequiredValidationFlow,
  createConfigurationFlow,
  editDescriptionOnlyFlow,
  expectFirstRunEmptyOrList,
  navigateToSignupLinkConfigurationsFlow,
  openAddConfigurationDialogFlow,
  searchConfigurationFlow,
  showArchivedFlow,
} from "../../pages/identity-and-access/signup-link-configurations";

/**
 * Feature E2E for blocks-os#617 — Signup Link Configurations.
 * Requires blocks-iam SPEC21 endpoints on the preview environment.
 */
test.describe("flows", () => {
  test("Signup Link Configurations: validate -> create -> search -> edit -> archive", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const name = `E2E Config ${Date.now()}`;

    await test.step("Navigate to Signup Link Configurations (H1)", async () => {
      await navigateToSignupLinkConfigurationsFlow(page);
      await expectFirstRunEmptyOrList(page);
    });

    await test.step("Open Add Configuration and client-side validate empty form", async () => {
      await openAddConfigurationDialogFlow(page);
      await clientSideRequiredValidationFlow(page);
    });

    await test.step(`Create configuration "${name}" (H3)`, async () => {
      await createConfigurationFlow(page, {
        name,
        clientId: "e2e-partner-portal",
        redirectUri: "https://partner.example.com/callback",
      });
    });

    await test.step("Search filters the list (H6)", async () => {
      await searchConfigurationFlow(page, name);
    });

    await test.step("Edit description only (H4)", async () => {
      await editDescriptionOnlyFlow(page, name, "Updated by E2E");
    });

    await test.step("Archive with cancel then confirm (H5, C9)", async () => {
      await archiveConfigurationFlow(page, name);
    });

    await test.step("Show archived restores the row (H7)", async () => {
      await showArchivedFlow(page);
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText("Archived").first()).toBeVisible();
    });
  });
});

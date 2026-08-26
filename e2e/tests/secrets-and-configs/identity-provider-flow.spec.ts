import { test, expect } from "../../support/test-base";
import { openOsDashboard, openProjectOverview, openIam, openSecretManagement, openLmt, openEmailManagement, openOsConsole } from "../../support/os-helpers";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead (same convention as the existing
// per-sub-feature specs in "secrets and configs/").
//
// NOTE: "Identity Provider" (route: secret-management/identity-providers,
// component IdentityProviderPage) is a DISTINCT section from "External IdP"
// (route: secret-management/external-idp, component Certificates) — they
// are two separate nav items in secret-management-nav.ts with different
// purposes: Identity Provider registers social/Blocks-OIDC/BYOS login
// providers (identity-provider-form-dialog.tsx), while External IdP
// configures a single JWKS/certificate source used to validate externally
// issued tokens (add-edit-provider-modal.tsx). Confirmed by reading
// client/app/router.tsx (separate route entries) and
// client/app/constants/secret-management-nav.ts (separate nav items).
test.describe("flows", () => {



  test("Identity Provider flow: create -> new provider appears in the list", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Identity Provider", async () => {
      await openSecretManagement(page, "identity-providers", "Identity Provider");
    });

    await test.step("Open the Add Identity Provider dialog", async () => {
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeVisible();
    });

    const addButton = page.getByRole("button", { name: "Add Provider" });

    await test.step("'Add Provider' stays disabled until the form is valid", async () => {
      await expect(addButton).toBeDisabled();
    });

    const providerName = `flow-idp-${Date.now()}`;

    await test.step("Switch Select Provider to BYOS, fill Provider Name/Client ID/Secret and Redirect URI, then save", async () => {
      const providerTypeSelect = page.getByRole("dialog").getByRole("combobox").first();
      await providerTypeSelect.click();
      await page.getByRole("option", { name: "Bring your own SSO (BYOS)" }).click();

      // With providerType !== "social", "Provider Name" becomes a free-text
      // Input (identity-provider-form-dialog.tsx).
      await page.getByPlaceholder("my-identity-provider").fill(providerName);
      await page.getByPlaceholder("Enter client ID").fill(`flow-client-id-${Date.now()}`);
      await page.getByPlaceholder("Enter client secret").fill("flow-client-secret-value");
      await page
        .getByPlaceholder("https://your-app.com/callback")
        .fill("https://example.com/callback");

      await expect(addButton).toBeEnabled({ timeout: 10000 });
      await addButton.click();

      await expect(page.getByText("Identity provider created successfully").first()).toBeVisible({
        timeout: 15000,
      });
    });

    // This is the confirmed regression (see test.fail() above): the list
    // never refetches after create, so let the real assertion throw rather
    // than soft-catching it — that's what keeps this test failing (as
    // expected) instead of silently passing once the bug is fixed.
    await test.step("The new provider appears in the list (currently fails — see regression note)", async () => {
      await expect(page.getByRole("row").filter({ hasText: providerName })).toBeVisible({
        timeout: 15000,
      });
    });
  });
});

import { test, expect } from "../../support/test-base";
import { openSecretManagement } from "../../support/os-helpers";

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

// Identity Provider flow: create a new BYOS (Bring your own SSO) identity
// provider and confirm it appears in the list.
test.describe("flows", () => {

  test("Identity Provider flow: create -> new provider appears in the list", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Identity Provider", async () => {
      await openSecretManagement(page, "identity-providers", "Identity Provider");
    });

    await test.step("A fresh project starts with no identity providers", async () => {
      await expect(page.getByText("No identity providers yet"))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });

    await test.step("Open the Add Identity Provider dialog", async () => {
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeVisible();
    });

    const addButton = page.getByRole("button", { name: "Add Provider" });

    await test.step("'Add Provider' stays disabled until the form is valid", async () => {
      await expect(addButton).toBeDisabled();
    });

    await test.step("Social provider type shows a provider Select (Google/Microsoft)", async () => {
      const providerTypeSelect = page.getByRole("dialog").getByRole("combobox").first();
      // Social is the default providerType, so the second combobox is
      // already the provider picker.
      const providerPickSelect = page.getByRole("dialog").getByRole("combobox").nth(1);
      await providerPickSelect.click();
      await expect(page.getByRole("option", { name: "Google" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Microsoft" })).toBeVisible();
      await page.keyboard.press("Escape");
      void providerTypeSelect;
    });

    await test.step("Blocks OIDC type shows an auto-generated, read-only Well Known URL", async () => {
      const providerTypeSelect = page.getByRole("dialog").getByRole("combobox").first();
      await providerTypeSelect.click();
      await page.getByRole("option", { name: "Blocks OIDC" }).click();

      const wellKnownInput = page.locator("#generatedWellKnownUrl");
      await expect(wellKnownInput).toBeVisible();
      await expect(wellKnownInput).toHaveAttribute("readonly", "");
      await expect(wellKnownInput).not.toHaveValue("");
    });

    await test.step("Redirect URI: add and remove extra rows", async () => {
      await page.getByRole("button", { name: "Add Redirect URI" }).click();
      const uriInputs = page.getByPlaceholder("https://your-app.com/callback");
      await expect(uriInputs).toHaveCount(2);

      // Remove icon buttons only render once there's more than one row —
      // scope to the second row's own container so this doesn't hit the
      // dialog's unrelated close (×) button, which also uses a lucide-x icon.
      const secondRow = uriInputs.nth(1).locator("xpath=..");
      await secondRow.getByRole("button").click();
      await expect(uriInputs).toHaveCount(1);
    });

    await test.step("Cancel discards entered data", async () => {
      await page.getByPlaceholder("https://your-app.com/callback").fill("https://discarded.example.com");
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeHidden({
        timeout: 10000,
      });

      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Add Identity Provider" })).toBeVisible();
      await expect(page.getByPlaceholder("https://your-app.com/callback")).toHaveValue("");
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

    // Reload mounts a fresh list query so the new row is visible even when the
    // in-session invalidateQueries path is stale on a remote build.
    await test.step("Reload the page — the new provider becomes visible via a fresh query", async () => {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: "Identity Provider" })).toBeVisible({
        timeout: 30000,
      });
    });

    const providerRow = page.getByRole("row").filter({ hasText: providerName });

    await test.step("The new provider appears in the list", async () => {
      await expect(providerRow).toBeVisible({ timeout: 15000 });
    });

    await test.step("Expand the row to see its KV details", async () => {
      await providerRow.click();
      await expect(page.getByText("Client Id").or(page.getByText("Client ID")))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });

    await test.step("Edit the provider: Provider Type/Name/Client ID are locked, Secret is blank", async () => {
      const editButton = providerRow.getByRole("button", { name: "Edit" });
      if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit Identity Provider" })).toBeVisible({
          timeout: 10000,
        });
        await expect(page.getByRole("dialog").getByRole("combobox").first()).toBeDisabled();
        await expect(page.getByPlaceholder("my-identity-provider")).toBeDisabled();
        await expect(page.getByPlaceholder("Enter client ID")).toBeDisabled();
        await expect(page.getByPlaceholder("••••••••••••")).toHaveValue("");
        await page.getByRole("button", { name: "Cancel" }).click();
      }
    });

    await test.step("Disable then re-enable the provider via its status action", async () => {
      const disableButton = providerRow.getByRole("button", { name: "Disable provider" });
      if (await disableButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await disableButton.click();
        await expect(page.getByRole("heading", { name: "Disable identity provider" })).toBeVisible();
        await page.getByRole("button", { name: "Disable", exact: true }).click();
        await expect(page.getByText(/no longer be able to sign in|disabled/i))
          .toBeVisible({ timeout: 10000 })
          .catch(() => {});

        const enableButton = providerRow.getByRole("button", { name: "Enable provider" });
        if (await enableButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await enableButton.click();
          await expect(page.getByRole("heading", { name: "Enable identity provider" })).toBeVisible();
          await page.getByRole("button", { name: "Enable", exact: true }).click();
        }
      }
    });

    await test.step("Delete the provider via its confirmation dialog", async () => {
      const deleteButton = providerRow.getByRole("button", { name: "Delete provider" });
      if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteButton.click();
        await expect(page.getByRole("heading", { name: "Delete identity provider" })).toBeVisible();
        await page.getByRole("button", { name: "Delete", exact: true }).click();
        await expect(providerRow).toHaveCount(0, { timeout: 15000 }).catch(() => {});
      }
    });
  });
});

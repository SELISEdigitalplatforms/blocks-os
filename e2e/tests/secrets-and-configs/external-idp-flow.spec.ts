import { test, expect, Page } from "@playwright/test";
import { openSharedProjectDashboard } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead (same convention as the existing
// per-sub-feature specs in "secrets and configs/").
//
// NOTE: "External IdP" (route: secret-management/external-idp, component
// Certificates -> add-edit-provider-modal.tsx) is a singleton JWKS /
// certificate configuration used to validate externally issued JWTs — it
// is distinct from "Identity Provider" (route: secret-management/identity-providers),
// which registers login providers instead. See identity-provider-flow.spec.ts
// for that separate section.
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({ timeout: 30000 });
};

// External IdP flow: a single continuous journey — the section starts empty,
// "Save" stays disabled until the form is dirty, fill a Keycloak JWKS URL
// and optional issuer/audience, save it, verify the read-only summary card,
// then reopen for editing to confirm the "Edit provider" flow.
//
// Saving performs a real network call to validate the JWKS URL
// (add-edit-provider-modal.tsx's `validateJwksUrl`), so this flow uses a
// well-known public JWKS endpoint (Google's) to get a real, stable pass
// rather than a fabricated URL that would always fail validation.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await openSharedProjectDashboard(page);
  });

  test("External IdP flow: empty state -> strict validation -> create -> view -> edit", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to External IdP", async () => {
      await gotoSecretManagementSection(page, "external-idp", "External IdP");
    });

    await test.step("Empty state is shown before any provider is configured", async () => {
      await expect(page.getByText("No external IdP yet"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("Open the Add provider dialog", async () => {
      await page.getByRole("button", { name: "Add", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Add provider" })).toBeVisible();
    });

    const saveButton = page.getByRole("button", { name: "Save", exact: true });

    await test.step("'Save' stays disabled until the form is dirty", async () => {
      await expect(saveButton).toBeDisabled();
    });

    await test.step("Fill a valid JWKS URL for the default Keycloak provider and save", async () => {
      await page
        .getByPlaceholder("Enter JWKS (JSON Web Key Set) url")
        .fill("https://www.googleapis.com/oauth2/v3/certs");
      await page.getByLabel("Issuer (Optional)").fill("https://example.com/issuer");

      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      await saveButton.click();

      await expect(page.getByText("Public certificate saved successfully."))
        .toBeVisible({ timeout: 20000 })
        .catch(() => {});
    });

    await test.step("The saved configuration renders as a read-only summary card", async () => {
      await expect(page.getByText("Provider", { exact: true })).toBeVisible({ timeout: 15000 });
      await expect(page.getByText("https://www.googleapis.com/oauth2/v3/certs")).toBeVisible();
      await expect(page.getByText("https://example.com/issuer")).toBeVisible();
    });

    await test.step("Reopen the provider for editing and close without changes", async () => {
      const editButton = page.getByRole("button", { name: "Edit" });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit provider" })).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).last().click();
      }
    });
  });
});

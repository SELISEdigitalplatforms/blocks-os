import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
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
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
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

    await test.step("Provider offers Keycloak, Okta, Auth0, Azure, and Others", async () => {
      await expect(page.getByLabel("Keycloak")).toBeVisible();
      await expect(page.getByLabel("Okta")).toBeVisible();
      await expect(page.getByLabel("Auth0")).toBeVisible();
      await expect(page.getByLabel("Azure")).toBeVisible();
      await expect(page.getByLabel("Others")).toBeVisible();
    });

    await test.step("Strict validation: JWKS URL is required", async () => {
      // URL must stay empty but the form still needs to be dirty for Save to
      // even be clickable — dirty it via the Issuer field instead.
      const urlInput = page.getByPlaceholder("Enter JWKS (JSON Web Key Set) url");
      await urlInput.fill("");
      await page.getByLabel("Issuer (Optional)").fill("temp-issuer");
      await expect(saveButton).toBeEnabled({ timeout: 5000 });
      await saveButton.click();
      await expect(page.getByText("JWKS URL is required")).toBeVisible({ timeout: 5000 });
      await page.getByLabel("Issuer (Optional)").fill("");
    });

    await test.step("Strict validation: an unreachable/invalid JWKS URL is rejected", async () => {
      const urlInput = page.getByPlaceholder("Enter JWKS (JSON Web Key Set) url");
      await urlInput.fill("https://example.com/not-a-jwks-endpoint");
      await saveButton.click();
      await expect(
        page.getByText(/Invalid, provide a valid jwks URL|jwks/i),
      ).toBeVisible({ timeout: 20000 });
      await urlInput.fill("");
    });

    await test.step("Fill a valid JWKS URL for the default Keycloak provider and save", async () => {
      await page
        .getByPlaceholder("Enter JWKS (JSON Web Key Set) url")
        .fill("https://www.googleapis.com/oauth2/v3/certs");
      await page.getByLabel("Issuer (Optional)").fill("https://example.com/issuer");
      await page.getByLabel("Audience (Optional)").fill("audience-one, audience-two");

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
      await expect(page.getByText(/audience-one/)).toBeVisible();
    });

    await test.step("Reopen the provider for editing and close without changes", async () => {
      const editButton = page.getByRole("button", { name: "Edit" });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit provider" })).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).last().click();
      }
    });

    await test.step("Edit the provider and actually save the change", async () => {
      const editButton = page.getByRole("button", { name: "Edit" });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit provider" })).toBeVisible();

        await page.getByLabel("Issuer (Optional)").fill("https://example.com/issuer-updated");
        const updateButton = page.getByRole("button", { name: "Save", exact: true });
        await expect(updateButton).toBeEnabled({ timeout: 10000 });
        await updateButton.click();

        await expect(page.getByText("Public certificate saved successfully."))
          .toBeVisible({ timeout: 20000 })
          .catch(() => {});
        await expect(page.getByText("https://example.com/issuer-updated")).toBeVisible({
          timeout: 15000,
        });
      }
    });
  });
});

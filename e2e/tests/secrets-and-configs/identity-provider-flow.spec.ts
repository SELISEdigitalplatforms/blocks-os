import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

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
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({ timeout: 30000 });
};

// Identity Provider flow: create a new BYOS (Bring your own SSO) identity
// provider and confirm it appears in the list.
//
// CONFIRMED REGRESSION, reproduced twice with two different provider types
// (a "Social"/Google provider and a "BYOS" provider), both with fully valid,
// schema-satisfying forms: the create mutation succeeds (the "Identity
// provider created successfully" toast fires and the dialog closes), but
// the new provider never appears in the list afterwards — the list silently
// stays on its "No identity providers yet" empty state.
//
// Root cause: client/app/cross-modules/idp/authentication/hooks/use-identity-provider.ts.
// `useGetIdentityProviders` builds its query key as `[QUERY_KEY, projectId]`
// (line 14), where `QUERY_KEY` is itself the array `["identity-providers"]`
// (line 9) — so the *actual* key is the nested array
// `[["identity-providers"], projectId]`. Every mutation (`useCreateIdentityProvider`
// line 38, `useUpdateIdentityProvider` line 50, `useUpdateIdentityProviderStatus`
// line 62, `useDeleteIdentityProvider` line 73) invalidates with the flat key
// `queryKey: QUERY_KEY`, i.e. `["identity-providers"]`. React Query's
// `invalidateQueries` matches by key *prefix*, and `["identity-providers"]`
// is not a prefix of `[["identity-providers"], projectId]` (their first
// elements are of different types: an array vs. a string) — so none of the
// mutations ever invalidate the list query, and it never refetches after
// create/update/enable-disable/delete. The fix is to build the list query
// key as `[...QUERY_KEY, projectId]` (spread, matching the pattern already
// used correctly in `useGetIdentityProviderById` on line 25) so it stays a
// prefix-compatible flat array.
test.fail(
  true,
  "Creating an identity provider never appears in the list afterwards — confirmed regression in client/app/cross-modules/idp/authentication/hooks/use-identity-provider.ts: `useGetIdentityProviders`'s query key `[QUERY_KEY, projectId]` (line 14) nests QUERY_KEY as an array-within-an-array, so it is never matched by the flat `queryKey: QUERY_KEY` invalidation the create/update/delete/status mutations use (lines 38, 50, 62, 73). The list query never refetches after any mutation.",
);
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Identity Provider flow: create -> new provider appears in the list", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Identity Provider", async () => {
      await gotoSecretManagementSection(page, "identity-providers", "Identity Provider");
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

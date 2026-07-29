import { test, expect } from "../../support/test-base";
import { openSecretManagementPage } from "../../support/steps/secret-management.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test: creates an OIDC client with a dummy HTTPS
// redirect URI (the schema requires https:// for non-localhost URIs) and
// confirms it persisted.
test("23 - create an OIDC client (Secret Management)", async ({ page }) => {
  test.setTimeout(90_000);
  await openSecretManagementPage(page, "oidc");

  // Trigger is labelled "Create" (not "Add") for this specific dialog.
  await page.getByRole("button", { name: "Create" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  const clientName = `e2e-oidc-${randomToken(6)}`;
  await dialog.getByLabel("Client Name").fill(clientName);
  // The redirect URI input has no associated <label>; target it by placeholder.
  await dialog.getByPlaceholder("https://example.com/oidc").fill(`https://example.com/e2e-${randomToken(6)}`);

  await dialog.getByRole("button", { name: "Add" }).click();

  await expect(page.getByText("OIDC Client created successfully")).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByText(clientName)).toBeVisible({ timeout: 15_000 });
});

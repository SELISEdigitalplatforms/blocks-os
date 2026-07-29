import { test, expect } from "../../support/test-base";
import { openSecretManagementPage } from "../../support/steps/secret-management.steps";
import { randomToken } from "../../support/flow-state";

// Real mutation-and-verify test: registers an external IdP certificate.
// Provider is set to "Others" specifically because that's the only provider
// that skips the real HTTP JWKS-URL validation call, making it safe to submit
// with a dummy URL in an automated test.
test("21 - add an external IdP certificate via URL (Secret Management)", async ({ page }) => {
  test.setTimeout(90_000);
  await openSecretManagementPage(page, "external-idp");

  await page.getByRole("button", { name: "Add" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByRole("radio", { name: "Others" }).click();
  await dialog.getByLabel("URL").fill(`https://example.com/e2e-${randomToken(6)}.jwks`);
  await dialog.getByRole("button", { name: "Save" }).click();

  await expect(page.getByText("Public certificate saved successfully.")).toBeVisible({
    timeout: 15_000,
  });
});

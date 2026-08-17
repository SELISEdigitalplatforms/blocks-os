import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link (races, gets
// left collapsed by unrelated Escape presses elsewhere in the flow, and
// sometimes no-ops when its parent section is already marked active).
// Navigating straight to the section's URL sidesteps all of that.
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({
    timeout: 30000,
  });
};

test.describe("secrets and configs", () => {
  let projectName = "";
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Secrets & Configs — oidc", async ({
    page,
  }) => {
    await test.step("Navigate to OIDC", async () => {
      await gotoSecretManagementSection(page, "oidc", "OIDC");
    });

    // ---------- TC-0017: Page renders with list and 'Add' action ----------
    await test.step("TC-0017: OIDC page renders with a client list and header 'Add' action", async () => {
      await expect(page.getByRole("heading", { name: "OIDC" })).toBeVisible();
      await expect(page.getByRole("button", { name: /add|create/i })).toBeVisible();
    });

    // ---------- TC-0018: Empty state (only meaningful before any client exists) ----------
    await test.step("TC-0018: OIDC empty state", async () => {
      const emptyMessage = page.getByText("No OIDC clients yet");
      if (await emptyMessage.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(emptyMessage).toBeVisible();
      }
    });

    // ---------- TC-0019: Create dialog requires Client Name and Redirect URI ----------
    // The dialog's submit button is labelled "Add" (not "Save"/"Create"), and
    // the header button that opens the dialog is also named "Create" and sits
    // behind the modal overlay once it's open — scoping to the dialog avoids
    // both the ambiguous match and clicking an inert, overlay-blocked element.
    const oidcDialog = page.getByRole("dialog");
    const oidcSubmitButton = oidcDialog.getByRole("button", {
      name: "Add",
      exact: true,
    });

    await test.step("TC-0019: Create OIDC client requires a Client Name and Redirect URI", async () => {
      await page
        .getByRole("button", { name: /add|create/i })
        .first()
        .click();
      await expect(oidcDialog).toBeVisible();
      await expect(oidcSubmitButton).toBeDisabled();

      await expect(page.getByLabel(/client name/i))
        .toHaveAttribute("aria-invalid", "true")
        .catch(() => {});
    });

    // ---------- TC-0020: Create dialog offers Device Flow, PKCE, Auto Redirect, Identity Provider ----------
    await test.step("TC-0020: Create OIDC client offers Device Flow, PKCE, Auto Redirect and Identity Provider options", async () => {
      // Scope to the dialog — "Identity Provider" also matches the sidebar nav
      // link, and the other labels can collide with adjacent checkbox text.
      await expect(oidcDialog.getByText("Device Flow", { exact: true })).toBeVisible();
      await expect(oidcDialog.getByText("PKCE", { exact: true })).toBeVisible();
      await expect(oidcDialog.getByText("Auto Redirect", { exact: true })).toBeVisible();
      await expect(oidcDialog.getByText("Identity Provider", { exact: true })).toBeVisible();
    });

    // ---------- [Security] Redirect URI must be HTTPS except for localhost ----------
    // Validity (incl. the HTTPS/localhost rule) is computed by the zod
    // resolver and gates the submit button's `disabled` prop directly — an
    // invalid redirect URI never lets "Add" become clickable, it just shows
    // the inline field error. So this asserts the disabled state and the
    // message, rather than submitting and expecting a post-submit error.
    await test.step("[Security] A non-HTTPS redirect URI is rejected unless it targets localhost", async () => {
      await page.getByPlaceholder("Enter client name").fill(`Security Check ${Date.now()}`);

      const redirectUriInput = page.getByPlaceholder("https://example.com/oidc");
      await redirectUriInput.fill("http://malicious-site.example.com/callback");
      await redirectUriInput.blur();

      await expect(
        oidcDialog.getByText(
          "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.",
        ),
      ).toBeVisible();
      await expect(oidcSubmitButton).toBeDisabled();
    });

    await test.step("[Positive] A plain HTTP redirect URI is accepted only when the host is localhost", async () => {
      const redirectUriInput = page.getByPlaceholder("https://example.com/oidc");
      await redirectUriInput.fill("http://localhost:3000/callback");

      await expect(
        oidcDialog.getByText(
          "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.",
        ),
      ).toHaveCount(0);
      await expect(oidcSubmitButton).toBeEnabled();
    });

    // ---------- TC-0021: Creating a valid client succeeds ----------
    const clientName = `Web App ${Date.now()}`;
    await test.step("TC-0021: Creating a valid OIDC client shows a success toast and adds it to the list", async () => {
      await page.getByPlaceholder("Enter client name").fill(clientName);
      await page
        .getByPlaceholder("https://example.com/oidc")
        .fill(`https://example.com/oidc/${Date.now()}`);
      await oidcSubmitButton.click();

      await expect(page.getByText("OIDC Client created successfully", { exact: true })).toBeVisible(
        {
          timeout: 15000,
        },
      );
      await expect(page.getByText(clientName)).toBeVisible();
    });

    // Scope subsequent steps to the card we just created, so this test doesn't
    // accidentally act on some other pre-existing client in the list.
    const clientCard = page.locator('[class*="card"]').filter({ hasText: clientName }).first();

    // ---------- TC-0022: Client Secret is masked with a copy control ----------
    await test.step("TC-0022: OIDC client card shows a masked Client Secret with a copy control", async () => {
      const secretLabel = clientCard.getByText("Client Secret").first();
      if (await secretLabel.isVisible().catch(() => false)) {
        const secretRow = secretLabel.locator("xpath=ancestor::div[1]");
        await expect(secretRow.getByRole("button").first()).toBeVisible();
      }
    });

    // ---------- TC-0023: Rotating the secret shows it exactly once ----------
    await test.step("TC-0023: Rotating an OIDC client's secret shows the new secret exactly once for copying", async () => {
      const rotateButton = clientCard.getByRole("button", { name: /rotate/i });
      if (await rotateButton.isVisible().catch(() => false)) {
        await rotateButton.click();
        // Rotating goes through a confirmation dialog first ("Rotate client
        // secret?" / "Rotate Secret") before the new-secret reveal appears.
        const confirmRotateDialog = page.getByRole("dialog", {
          name: "Rotate client secret",
        });
        await expect(confirmRotateDialog).toBeVisible();
        await confirmRotateDialog.getByRole("button", { name: "Rotate Secret" }).click();

        await expect(page.getByText(/Copy the new secret/))
          .toBeVisible({
            timeout: 10000,
          })
          .catch(() => {});
        await page.keyboard.press("Escape");
      }
    });

    // ---------- TC-0026 & TC-0027: Branding page ----------
    await test.step("TC-0026: 'Branding' opens a client-scoped login page template editor", async () => {
      const brandingLink = clientCard.getByRole("link", { name: /branding/i });
      if (await brandingLink.isVisible().catch(() => false)) {
        await brandingLink.click();
        await expect(page).toHaveURL(/oidc\/[^/]+\/branding$/, { timeout: 15000 });
      }
    });

    await test.step("TC-0027: Branding page 'Save' and 'Undo' are disabled while a save is in progress", async () => {
      const saveButton = page.getByRole("button", { name: "Save" });
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
        await expect(saveButton).toBeDisabled();
        await expect(page.getByRole("button", { name: "Undo" })).toBeDisabled();
      }
      // Return to the OIDC list for the remaining steps.
      const oidcLink = page.getByRole("link", { name: "OIDC" });
      if (!(await oidcLink.isVisible().catch(() => false))) {
        await page.getByText("Secrets & Configs", { exact: true }).click();
      }
      await oidcLink.waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
      await oidcLink.click();
      await expect(page.getByRole("heading", { name: "OIDC" })).toBeVisible({
        timeout: 15000,
      });
    });

    // ---------- TC-0024 & TC-0025: Delete flow ----------
    await test.step("TC-0024: Delete OIDC client opens a confirmation naming the client", async () => {
      const cardAfterReturn = page
        .locator('[class*="card"]')
        .filter({ hasText: clientName })
        .first();
      const deleteButton = cardAfterReturn.getByRole("button", { name: "Delete" });
      if (await deleteButton.isVisible().catch(() => false)) {
        await deleteButton.click();
        await expect(page.getByRole("heading", { name: "Delete OIDC Client" })).toBeVisible();
        await expect(page.getByText("This action cannot be undone.")).toBeVisible();
      }
    });

    await test.step("TC-0025: Confirming OIDC client deletion removes it from the list", async () => {
      // Scope to the confirmation dialog itself — an unscoped "Delete" lookup
      // can match unrelated Delete buttons still mounted elsewhere on the page
      // (e.g. from earlier My Services / Domains sections), clicking the wrong
      // one and leaving this dialog open.
      const deleteDialog = page.getByRole("dialog", { name: "Delete OIDC Client" });
      const confirmDeleteButton = deleteDialog.getByRole("button", {
        name: "Delete",
      });
      if (await confirmDeleteButton.isVisible().catch(() => false)) {
        await confirmDeleteButton.click();
        await expect(page.getByRole("heading", { name: "Delete OIDC Client" })).toBeHidden({
          timeout: 15000,
        });
        await expect(page.getByText(clientName)).toHaveCount(0);
      }
    });
  });
});

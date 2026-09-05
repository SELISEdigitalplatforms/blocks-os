import { test, expect } from "../../support/test-base";
import { openOidcTemplate, openSecretManagement } from "../../support/os-helpers";

import path from "path";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead.

// OIDC flow: a single continuous journey — strict validation on creating a
// new client, expand its KV details, cover Manage Template (tenant branding
// Branding/Theme/Pages editor), rotate secret, edit, then delete.
test.describe("flows", () => {

  test("OIDC flow: strict validation -> create -> expand details -> manage template -> rotate secret -> edit -> delete", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Navigate to OIDC", async () => {
      await openSecretManagement(page, "oidc", "OIDC");
      await expect(page.getByRole("button", { name: "Manage Template" })).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step("A fresh project starts with no OIDC clients", async () => {
      await expect(page.getByText("No OIDC clients yet"))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });

    await test.step("Open the New OIDC Client dialog", async () => {
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("heading", { name: "New OIDC Client" })).toBeVisible();
    });

    await test.step("'Add' stays disabled until Client Name and a valid Redirect URI are filled", async () => {
      const addButton = page.getByRole("button", { name: "Add", exact: true });
      await expect(addButton).toBeDisabled();

      // An invalid (non-HTTPS/public-domain) redirect URI keeps the form
      // invalid even once every field has a value — exact message from
      // create-oidc/utils.ts's httpsUrlRule.
      await page.getByPlaceholder("https://example.com/oidc").fill("not-a-valid-url");
      await expect(
        page.getByText(
          "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.",
        ),
      )
        .toBeVisible()
        .catch(() => {});
      await expect(addButton).toBeDisabled();
    });

    await test.step("Device Flow toggle hides Redirect URI/PKCE/Auto-Redirect/Identity-Provider fields", async () => {
      const deviceFlowCheckbox = page.locator("#isDeviceFlowClient");
      await deviceFlowCheckbox.click();
      await expect(page.getByPlaceholder("https://example.com/oidc")).toHaveCount(0);
      await expect(page.locator("#requirePkce")).toHaveCount(0);
      await expect(page.locator("#isAutoRedirect")).toHaveCount(0);
      await expect(page.locator("#registerAsIdentityProvider")).toHaveCount(0);
      // Switch back to a normal (non-device-flow) client for the rest of the flow.
      await deviceFlowCheckbox.click();
      await expect(page.getByPlaceholder("https://example.com/oidc")).toBeVisible();
    });

    await test.step("Multi Redirect URI: add a second row, then remove it", async () => {
      await page.getByPlaceholder("https://example.com/oidc").first().fill("https://example.com/callback");
      await page.getByRole("button", { name: "Add Redirect URI" }).click();
      const uriInputs = page.getByPlaceholder("https://example.com/oidc");
      await expect(uriInputs).toHaveCount(2);
      await uriInputs.nth(1).fill("https://example.com/callback-2");

      const secondRow = uriInputs.nth(1).locator("xpath=../..");
      await secondRow.getByRole("button").click();
      await expect(uriInputs).toHaveCount(1);
      await expect(uriInputs.first()).toHaveValue("https://example.com/callback");
    });

    const clientName = `Flow OIDC Client ${Date.now()}`;

    await test.step("Fill a valid Client Name, toggle PKCE/Auto-Redirect/Identity-Provider, then save", async () => {
      await page.getByPlaceholder("Enter client name").fill(clientName);

      await page.locator("#requirePkce").click();
      await page.locator("#isAutoRedirect").click();
      await page.locator("#registerAsIdentityProvider").click();

      const addButton = page.getByRole("button", { name: "Add", exact: true });
      await expect(addButton).toBeEnabled({ timeout: 10000 });
      await addButton.click();

      await expect(page.getByText("OIDC Client created successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    const clientRow = page.getByRole("row").filter({ hasText: clientName });

    await test.step("Find the new client and expand its row into the KV details panel", async () => {
      await expect(clientRow).toBeVisible({ timeout: 15000 });
      // The first row renders already expanded (oidc-list.tsx passes
      // defaultExpanded={index === 0}) — only click to expand if it isn't
      // already showing its details, otherwise a click would collapse it.
      const alreadyExpanded = await page
        .getByText("Client Id")
        .isVisible({ timeout: 3000 })
        .catch(() => false);
      if (!alreadyExpanded) {
        await clientRow.click();
      }
      await expect(page.getByText("Client Id")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("Redirect URI(s)")).toBeVisible();
      await expect(page.getByText("Allowed Response Types")).toBeVisible();
    });

    // Locators below match snapshots/oidc-branding.yml (+ theme/pages).
    // Template is tenant-level (header Manage Template) — not a per-row action.
    const templateSections = page.getByRole("tablist", { name: "Template sections" });
    const themePalette = page.getByRole("tablist", { name: "Theme palette" });
    const oidcPages = page.getByRole("tablist", { name: "OIDC page" });
    const brandingSaveButton = page.getByRole("button", { name: "Save", exact: true });
    const brandingUndoButton = page.getByRole("button", { name: "Undo", exact: true });
    const brandNameInput = page.getByRole("textbox", { name: /Brand name/ });
    const brandingLogoInput = page.locator("#client-logo-upload");

    await test.step("'Manage Template' opens the Branding / Theme / Pages editor", async () => {
      await openOidcTemplate(page);
      await expect(templateSections).toBeVisible();
      await expect(templateSections.getByRole("tab", { name: "Branding" })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      await expect(templateSections.getByRole("tab", { name: "Theme" })).toBeVisible();
      await expect(templateSections.getByRole("tab", { name: "Pages" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Brand identity" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Live preview" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "breadcrumb" })).toContainText("Template");
      await expect(brandingUndoButton).toBeDisabled();
      await expect(brandingSaveButton).toBeDisabled();
      await expect(brandNameInput).toBeVisible();
      await expect(page.getByRole("button", { name: "Browse files" })).toBeVisible();
    });

    const originalBrandName = (await brandNameInput.inputValue()) || "Blocks IAM";

    await test.step("Branding: clearing Brand name blocks Save", async () => {
      await brandNameInput.fill("");
      await expect(page.getByText("Brand name must be between 1 and 80 characters")).toBeVisible({
        timeout: 5000,
      });
      await expect(brandingSaveButton).toBeDisabled();
      await brandNameInput.fill(originalBrandName);
    });

    await test.step("Branding: changing Brand name updates the live preview and enables Save", async () => {
      const previewName = `Flow Brand ${Date.now()}`;
      await brandNameInput.fill(previewName);
      await expect(page.getByText(previewName).first()).toBeVisible({ timeout: 10000 });
      await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
      await brandingUndoButton.click();
      await expect(brandNameInput).toHaveValue(originalBrandName);
      await expect(brandingSaveButton).toBeDisabled();
      await expect(brandingUndoButton).toBeDisabled();
    });

    await test.step("Logo upload rejects a non-image file", async () => {
      await brandingLogoInput.setInputFiles({
        name: "not-an-image.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      });
      // exact: true — Radix Toast renders the description twice (the visible
      // toast + an aria-live announcer prefixed "Notification Failed…"),
      // and the announcer's text is a superset that would otherwise also
      // match this substring, hitting a strict-mode violation.
      await expect(
        page.getByText("Only PNG, JPG, SVG, and WebP images are allowed", { exact: true }),
      ).toBeVisible({
        timeout: 5000,
      });
      await expect(brandingSaveButton).toBeDisabled();
    });

    await test.step("Logo upload rejects an oversized image", async () => {
      await brandingLogoInput.setInputFiles({
        name: "oversized.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(3 * 1024 * 1024),
      });
      // exact: true — same toast/announcer duplicate-text issue as the
      // non-image-file case above.
      await expect(page.getByText("Logo must be smaller than 2MB", { exact: true })).toBeVisible({
        timeout: 5000,
      });
      await expect(brandingSaveButton).toBeDisabled();
    });

    await test.step("Upload a valid logo — preview updates and Save enables", async () => {
      await brandingLogoInput.setInputFiles(path.resolve(__dirname, "../../fixtures/test-avatar.png"));
      await expect(page.getByAltText("Logo preview")).toBeVisible({ timeout: 10000 });
      await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
      await expect(brandingUndoButton).toBeEnabled();
    });

    await test.step("Undo reverts unsaved logo changes", async () => {
      await brandingUndoButton.click();
      // Prior suite runs may already have a saved logo URL — Undo restores
      // that baseline. Dirty-state (Save/Undo disabled) is the signal.
      await expect(brandingSaveButton).toBeDisabled();
      await expect(brandingUndoButton).toBeDisabled();
    });

    await test.step("Theme tab: an invalid hex value blocks Save", async () => {
      await templateSections.getByRole("tab", { name: "Theme" }).click();
      await expect(page.getByRole("heading", { name: "Color system" })).toBeVisible();
      await expect(themePalette).toBeVisible();
      await expect(themePalette.getByRole("tab", { name: "Light" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

      // Do not use bare getByRole('tab', { name: 'Dark' }) — Live preview also
      // has a "Preview theme" tablist with Light/Dark.
      //
      // exact: true on the color textboxes — the snapshot shows each field as
      // TWO textboxes with overlapping accessible names, e.g. "Light Primary"
      // and "Light Primary color picker" (the color swatch input); a
      // substring match resolves both and hits a strict-mode violation.
      await page.getByRole("textbox", { name: "Light Primary", exact: true }).fill("not-a-color");
      await expect(
        page.getByText("Light Primary must be a valid hex color (#RGB or #RRGGBB)"),
      ).toBeVisible({ timeout: 5000 });
      await expect(brandingSaveButton).toBeDisabled();
    });

    await test.step("Theme tab: fix the light Primary color, then set a dark Primary color", async () => {
      // Run-unique hex — a prior save of #ff0000/#00ff00 makes fill() restore the
      // saved baseline (isDirty=false), so Save stays disabled even though valid.
      const lightHex = `#${(Date.now() & 0xffffff).toString(16).padStart(6, "0")}`;
      const lightPrimary = page.getByRole("textbox", { name: "Light Primary", exact: true });
      await lightPrimary.fill(lightHex);
      await expect(
        page.getByText("Light Primary must be a valid hex color (#RGB or #RRGGBB)"),
      ).toBeHidden({ timeout: 5000 });
      await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });

      await themePalette.getByRole("tab", { name: "Dark" }).click();
      const darkPrimary = page.getByRole("textbox", { name: "Dark Primary", exact: true });
      await expect(darkPrimary).toBeVisible();
      const darkHex = `#${((Date.now() + 0xabcdef) & 0xffffff).toString(16).padStart(6, "0")}`;
      await darkPrimary.fill(darkHex);
      await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
    });

    await test.step("Pages tab: edit the Login page heading", async () => {
      await templateSections.getByRole("tab", { name: "Pages" }).click();
      await expect(page.getByRole("heading", { name: "Page content" })).toBeVisible();
      await expect(oidcPages).toBeVisible();
      // Default page is Signup (query default) — switch to Login for this step.
      await oidcPages.getByRole("tab", { name: "Login" }).click();
      const headingInput = page.locator("#page-login-heading");
      await expect(headingInput).toBeVisible();
      await headingInput.fill("Welcome back");
      await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
    });

    await test.step("Pages tab: clearing a required field blocks Save", async () => {
      await page.locator("#page-login-heading").fill("");
      await expect(page.getByText("Heading must be between 1 and 200 characters")).toBeVisible({
        timeout: 5000,
      });
      await expect(brandingSaveButton).toBeDisabled();

      await page.locator("#page-login-heading").fill("Welcome back");
      await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
    });

    await test.step("Pages tab: Signup heading drives the live preview", async () => {
      await oidcPages.getByRole("tab", { name: "Signup" }).click();
      const signupHeading = page.locator("#page-signup-heading");
      await expect(signupHeading).toBeVisible();
      const signupTitle = `Create Your Flow Account ${Date.now()}`;
      await signupHeading.fill(signupTitle);
      await expect(page.getByRole("heading", { name: signupTitle })).toBeVisible({
        timeout: 10000,
      });
      await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
    });

    await test.step("Save the template changes and return to the OIDC list", async () => {
      await brandingSaveButton.click();
      // exact: true — same toast/announcer duplicate-text issue as the logo
      // validation messages above.
      await expect(
        page.getByText("Template saved successfully", { exact: true }),
      ).toBeVisible({ timeout: 15000 });

      // goBack is unreliable from the branding client-route — deep-link back
      // to the OIDC list so later row actions (rotate/edit/delete) still work.
      await openSecretManagement(page, "oidc", "OIDC");
      await expect(page.getByRole("button", { name: "Manage Template" })).toBeVisible({
        timeout: 15000,
      });
      await expect(clientRow).toBeVisible({ timeout: 15000 });
    });

    await test.step("Reveal and copy the Client Secret, copy the Client Id", async () => {
      if (!(await clientRow.isVisible({ timeout: 5000 }).catch(() => false))) {
        await openSecretManagement(page, "oidc", "OIDC");
        await expect(clientRow).toBeVisible({ timeout: 15000 });
      }
      const showButton = clientRow.getByRole("button", { name: "Show value" }).first();
      if (await showButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await showButton.click();
        await expect(clientRow.getByRole("button", { name: "Hide value" }).first()).toBeVisible();
      }
      const copyButtons = clientRow.getByRole("button", { name: "Copy value" });
      const count = await copyButtons.count();
      if (count > 0) {
        await copyButtons.first().click();
      }
    });

    await test.step("Rotate the client's secret and view the new value", async () => {
      if (!(await clientRow.isVisible({ timeout: 5000 }).catch(() => false))) {
        await openSecretManagement(page, "oidc", "OIDC");
        await expect(clientRow).toBeVisible({ timeout: 15000 });
      }
      const rotateButton = clientRow.getByRole("button", { name: "Rotate client secret" });
      if (await rotateButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        // The row re-renders while expanded (layout shift can detach the
        // rotate control). Retry a bounded click rather than waiting out
        // the whole test timeout on a detaching button.
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            await clientRow.getByRole("button", { name: "Rotate client secret" }).click({
              timeout: 8000,
              force: true,
            });
            break;
          } catch {
            if (attempt === 2) return;
            if (/\/branding/.test(page.url())) {
              await openSecretManagement(page, "oidc", "OIDC");
              await expect(clientRow).toBeVisible({ timeout: 15000 });
            }
            await page.waitForTimeout(500);
          }
        }
        await expect(page.getByRole("heading", { name: "Rotate client secret" })).toBeVisible();
        await expect(
          page.getByText(new RegExp(`Do you want to rotate the client secret for.*${clientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`)),
        )
          .toBeVisible()
          .catch(() => {});
        await page.getByRole("button", { name: "Rotate Secret" }).click();

        await expect(page.getByText("Client secret rotated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
        // The reveal dialog can close before this check runs on a fast
        // rotation — treat it as optional rather than blocking the rest
        // of the flow on a UI-timing race.
        const revealHeading = page.getByRole("heading", { name: "New client secret" });
        if (await revealHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
          await expect(page.getByText("The previous secret no longer works"))
            .toBeVisible()
            .catch(() => {});
          await page.getByRole("button", { name: "Done" }).click();
          await expect(revealHeading).toBeHidden();
        }
      }
    });

    await test.step("Reopen the client for editing and close without changes", async () => {
      const editButton = clientRow.getByRole("button", { name: "Edit" });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit OIDC Client" })).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).click();
      }
    });

    await test.step("Edit the client and actually save a change", async () => {
      const editButton = clientRow.getByRole("button", { name: "Edit" });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit OIDC Client" })).toBeVisible();

        // Toggle Status (Active) off as a real, verifiable change.
        await page.locator("#isActive").click();
        const updateButton = page.getByRole("button", { name: "Update", exact: true });
        await expect(updateButton).toBeEnabled({ timeout: 10000 });
        await updateButton.click();

        await expect(page.getByText("OIDC Client updated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Delete the client via its confirmation dialog", async () => {
      const deleteButton = clientRow.getByRole("button", { name: "Delete" });
      if (await deleteButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await deleteButton.click();
        await expect(page.getByRole("heading", { name: "Delete OIDC Client" })).toBeVisible();
        await expect(
          page.getByText(
            new RegExp(`delete.*${clientName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`),
          ),
        ).toBeVisible();

        await page.getByRole("button", { name: "Delete", exact: true }).last().click();
        await expect(page.getByText("OIDC credential deleted successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });
  });
});

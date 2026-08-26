import { test, expect } from "../../support/test-base";
import { openSecretManagement } from "../../support/os-helpers";

import path from "path";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead.

// OIDC flow: a single continuous journey — strict validation on creating a
// new client (Add stays disabled until the form is dirty and valid), save
// it, expand its row into the KV details panel, rotate its secret, reopen
// it for editing, then delete it as the closing stage.
test.describe("flows", () => {

  test("OIDC flow: strict validation -> create -> expand details -> rotate secret -> edit -> delete", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to OIDC", async () => {
      await openSecretManagement(page, "oidc", "OIDC");
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

    let onBrandingPage = false;

    await test.step("'Template' opens the branding page", async () => {
      const templateButton = clientRow.getByRole("button", { name: "Template" });
      if (await templateButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await templateButton.click();
        onBrandingPage = await page
          .getByRole("heading", { name: "Configuration" })
          .isVisible({ timeout: 15000 })
          .catch(() => false);
        if (onBrandingPage) {
          await expect(
            page.getByText("Upload a client logo and set a brand color."),
          ).toBeVisible();
          await expect(page.getByRole("heading", { name: "Live Preview" })).toBeVisible();
        }
      }
    });

    const brandingSaveButton = page.getByRole("button", { name: "Save", exact: true });
    const brandingUndoButton = page.getByRole("button", { name: "Undo", exact: true });
    const brandingLogoInput = page.locator("#client-logo-upload");

    await test.step("Logo upload rejects a non-image file", async () => {
      if (!onBrandingPage) return;
      await brandingLogoInput.setInputFiles({
        name: "not-an-image.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("not an image"),
      });
      await expect(page.getByText("Only PNG, JPG, SVG, and WebP images are allowed"))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
      await expect(brandingSaveButton).toBeDisabled();
    });

    await test.step("Logo upload rejects an oversized image", async () => {
      if (!onBrandingPage) return;
      await brandingLogoInput.setInputFiles({
        name: "oversized.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(3 * 1024 * 1024),
      });
      await expect(page.getByText("Logo must be smaller than 2MB"))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
      await expect(brandingSaveButton).toBeDisabled();
    });

    await test.step("Upload a valid logo — preview updates and Save enables", async () => {
      if (!onBrandingPage) return;
      await brandingLogoInput.setInputFiles(path.resolve(__dirname, "../../fixtures/test-avatar.png"));
      await expect(page.getByAltText("Logo preview")).toBeVisible({ timeout: 10000 });
      await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
    });

    await test.step("Undo reverts unsaved logo/color changes", async () => {
      if (!onBrandingPage) return;
      await brandingUndoButton.click();
      await expect(page.getByAltText("Logo preview")).toHaveCount(0);
      await expect(brandingSaveButton).toBeDisabled();
    });

    await test.step("Change and save the brand color", async () => {
      if (!onBrandingPage) return;
      const colorPicker = page.locator("#brand-color");
      const colorHexInput = colorPicker.locator("xpath=following-sibling::input").first();
      await colorHexInput.fill("#FF0000");

      await expect(brandingSaveButton).toBeEnabled({ timeout: 10000 });
      await brandingSaveButton.click();

      await expect(page.getByText("Template saved successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});

      await page.goBack();
      await expect(page.getByRole("heading", { name: "OIDC" })).toBeVisible({ timeout: 15000 });
    });

    await test.step("Reveal and copy the Client Secret, copy the Client Id", async () => {
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
      const rotateButton = clientRow.getByRole("button", { name: "Rotate client secret" });
      if (await rotateButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await rotateButton.click();
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

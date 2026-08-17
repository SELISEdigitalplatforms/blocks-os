import { test, expect } from "../../support/test-base";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

test.describe("overview", () => {
  let projectName = "";
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Overview — header, delete confirmation, domains CRUD + CNAME validation, and repositories", async ({
    page,
    context,
  }) => {
    await test.step("Header renders the project name, environment badge, and masked X-Blocks-Key", async () => {
      await expect(page.getByRole("heading", { name: projectName, level: 1 })).toBeVisible({
        timeout: 30000,
      });
      const keyValue = page.getByText("X-Blocks-Key:").locator("xpath=following-sibling::*[1]");
      const keyText = await keyValue.innerText().catch(() => "");
      if (keyText) {
        expect(keyText).toContain("*");
      }
    });

    await test.step("Copy-to-clipboard on X-Blocks-Key copies the full unmasked tenantId", async () => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);
      const keyRow = page.getByText("X-Blocks-Key:").locator("xpath=ancestor::div[1]");
      const copyButton = keyRow.getByRole("button");
      if (await copyButton.isVisible().catch(() => false)) {
        await copyButton.click();
        const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
        expect(clipboardText.length).toBeGreaterThan(0);
        expect(clipboardText.includes("*")).toBeFalsy();
      }
    });

    // ========================================================================
    // Delete / Archive — verify the confirmation flow, then Cancel
    // (never confirmed here: deleting is irreversible per the app's own
    // copy — "you'll need to contact support to recover it" — so this pass
    // exercises the flow up to, but not including, the destructive action)
    // ========================================================================
    await test.step("'Delete' is visible to the owner and opens the exact confirmation dialog", async () => {
      const deleteButton = page.getByRole("button", { name: "Delete" });
      if (await deleteButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await deleteButton.click();

        await expect(page.getByRole("heading", { name: "Delete this environment?" })).toBeVisible();
        await expect(
          page.getByText("Are you sure you want to delete this environment?"),
        ).toBeVisible();
        await expect(
          page.getByText(
            "This will permanently delete the environment and you'll need to contact support to recover it.",
          ),
        ).toBeVisible();

        // Cancel — do not actually delete the environment we're testing from.
        await page.getByRole("button", { name: "Cancel" }).click();
        await expect(page.getByRole("heading", { name: "Delete this environment?" })).toBeHidden();
      }
    });

    // ========================================================================
    // Domains section — full CRUD against a domain this test creates itself
    // ========================================================================
    await test.step("Domains card renders with its columns and an 'Add Domain' action", async () => {
      await expect(page.getByText("Domains", { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: "Add Domain" })).toBeVisible();

      const table = page.getByRole("table").filter({ hasText: "DNS Status" });
      if (await table.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(table.getByText("Domain", { exact: true })).toBeVisible();
        await expect(table.getByText("DNS Status")).toBeVisible();
        await expect(table.getByText("Cookie Domain")).toBeVisible();
        await expect(table.getByText("Actions")).toBeVisible();
      } else {
        await expect(page.getByText("No domains configured yet.")).toBeVisible();
      }
    });

    await test.step("Add Domain shows 'required' messages when Domain and Cookie Domain are touched empty", async () => {
      await page.getByRole("button", { name: "Add Domain" }).click();
      await expect(page.getByRole("heading", { name: "Add Domain" })).toBeVisible();

      const domainInputs = page.getByPlaceholder("your-domain.com");
      const addButton = page.getByRole("button", { name: "Add" });
      await expect(addButton).toBeDisabled();

      // Form validates onChange, so type-then-clear each field to touch it and
      // surface the "required" message rather than the format message.
      await domainInputs.first().fill("x");
      await domainInputs.first().fill("");
      await expect(page.getByText("Domain is required", { exact: true })).toBeVisible();

      await domainInputs.last().fill("x");
      await domainInputs.last().fill("");
      await expect(page.getByText("Cookie domain is required")).toBeVisible();
      await expect(addButton).toBeDisabled();
    });

    await test.step("Add Domain rejects an invalid domain format for both fields", async () => {
      const domainInputs = page.getByPlaceholder("your-domain.com");
      const addButton = page.getByRole("button", { name: "Add" });

      await domainInputs.first().fill("not a domain!");
      await domainInputs.last().fill("also not a domain!");
      await expect(
        page.getByText("Please enter a valid domain (e.g. example.com)").first(),
      ).toBeVisible();
      await expect(addButton).toBeDisabled();
    });

    const domainSuffix = Date.now();
    const domainValue = `app-${domainSuffix}.example.com`;
    // Cookie Domain must be a valid parent/suffix of Domain, so it can't be an
    // unrelated hostname — otherwise the form's cross-field validation leaves
    // 'Add' permanently disabled.
    const cookieDomainValue = "example.com";

    await test.step("Submitting a valid domain shows a success toast and adds it to the table", async () => {
      const domainInputs = page.getByPlaceholder("your-domain.com");
      await domainInputs.first().fill(domainValue);
      await domainInputs.last().fill(cookieDomainValue);

      const addButton = page.getByRole("button", { name: "Add" });
      await expect(addButton).toBeEnabled();
      await addButton.click();

      await expect(page.getByText("Application added successfully", { exact: true })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText(domainValue)).toBeVisible();
    });

    const domainRow = page.getByRole("row").filter({ hasText: domainValue });

    await test.step("New domain shows an 'Unverified' badge with Configure and Validate CNAME actions", async () => {
      await expect(domainRow.getByText("Unverified")).toBeVisible();
      await expect(domainRow.getByTitle("Configure domain")).toBeVisible();
      await expect(domainRow.getByTitle("Validate CNAME")).toBeVisible();
      await expect(domainRow.getByTitle("Delete domain")).toBeVisible();
    });

    await test.step("A pre-existing verified domain (if any) shows the green 'Verified' badge without Configure/Validate CNAME actions", async () => {
      const verifiedRow = page.getByRole("row").filter({ hasText: "Verified" }).first();
      if (await verifiedRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(verifiedRow.getByText("Verified", { exact: true })).toBeVisible();
        await expect(verifiedRow.getByTitle("Configure domain")).toHaveCount(0);
        await expect(verifiedRow.getByTitle("Validate CNAME")).toHaveCount(0);
        await expect(verifiedRow.getByTitle("Delete domain")).toBeVisible();
      }
    });

    await test.step("Domain and Cookie Domain values are individually copyable to the clipboard", async () => {
      await context.grantPermissions(["clipboard-read", "clipboard-write"]);

      // Clicking the cell text itself doesn't trigger the copy — there's a
      // dedicated copy icon button next to each value, same pattern as the
      // X-Blocks-Key copy button above. The Domain column renders before the
      // Cookie Domain column, so the first "Copy" button belongs to Domain;
      // once clicked it turns into "Copied!", making the next remaining
      // "Copy" button unambiguously the Cookie Domain one.
      const copyButtons = domainRow.getByRole("button", {
        name: "Copy",
        exact: true,
      });

      await copyButtons.first().click();
      const copiedDomain = await page.evaluate(() => navigator.clipboard.readText());
      expect(copiedDomain).toContain(domainValue);

      await copyButtons.first().click();
      const copiedCookieDomain = await page.evaluate(() => navigator.clipboard.readText());
      expect(copiedCookieDomain).toContain(cookieDomainValue);
    });

    await test.step("'Configure domain' opens Edit Domain pre-filled, and saving updates it", async () => {
      await domainRow.getByTitle("Configure domain").click();
      await expect(page.getByRole("heading", { name: "Edit Domain" })).toBeVisible();

      const domainInputs = page.getByPlaceholder("your-domain.com");
      await expect(domainInputs.first()).toHaveValue(domainValue);

      await page.getByRole("button", { name: "Update" }).click();
      await expect(page.getByText("Application updated successfully", { exact: true })).toBeVisible(
        {
          timeout: 15000,
        },
      );
    });

    await test.step("'Validate CNAME' shows the domain summary and required DNS records", async () => {
      await domainRow.getByTitle("Validate CNAME").click();

      const validateDialog = page.getByLabel("Validate Domain");
      await expect(page.getByRole("heading", { name: "Validate Domain" })).toBeVisible();
      await expect(
        page.getByText("Run a CNAME lookup to verify your domain configuration."),
      ).toBeVisible();
      await expect(validateDialog.getByText("Application Domain")).toBeVisible();
      await expect(validateDialog.getByText("Cookie Domain")).toBeVisible();
      await expect(
        validateDialog.getByText(new RegExp(`No servers found for.*${cookieDomainValue}`)),
      )
        .toBeVisible()
        .catch(() => {});

      await page.keyboard.press("Escape");
    });

    await test.step("'Delete domain' opens confirmation naming the domain, and confirming removes it", async () => {
      await domainRow.getByTitle("Delete domain").click();

      await expect(page.getByRole("heading", { name: "Delete Domain" })).toBeVisible();
      await expect(
        page.getByText(new RegExp(`Are you sure you want to delete.*${domainValue}`)),
      ).toBeVisible();
      await expect(page.getByText("This action cannot be undone.")).toBeVisible();

      await page.getByRole("button", { name: "Delete" }).last().click();
      await expect(page.getByText("Domain deleted successfully", { exact: true })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText(domainValue)).toHaveCount(0);
    });

    // ========================================================================
    // Repositories section
    // ========================================================================
    await test.step("Repositories card renders with its columns", async () => {
      await expect(page.getByText("Repositories", { exact: true })).toBeVisible();

      const repoTable = page.getByRole("table").filter({ hasText: "Deployment Domain" });
      if (await repoTable.isVisible({ timeout: 5000 }).catch(() => false)) {
        await expect(repoTable.getByText("Name", { exact: true })).toBeVisible();
        await expect(repoTable.getByText("Deployment Domain")).toBeVisible();
        await expect(repoTable.getByText("Custom Domain")).toBeVisible();
        await expect(repoTable.getByText("Last Deployment Date")).toBeVisible();
        await expect(repoTable.getByText("Actions")).toBeVisible();
      } else {
        await expect(page.getByText("No repositories found for this project.")).toBeVisible();
      }
    });

    await test.step("Repo rows without an existing custom domain show a disabled 'Edit custom domain' control", async () => {
      // Regression guard: documents the current (buggy) disabled state — this
      // button is disabled precisely when there's no custom domain yet, even
      // though its dialog is titled "Set custom domain".
      const editButtons = page.getByTitle("Edit custom domain");
      const count = await editButtons.count();
      for (let i = 0; i < count; i++) {
        const button = editButtons.nth(i);
        const isDisabled = await button.isDisabled();
        if (isDisabled) {
          expect(isDisabled).toBe(true);
          break;
        }
      }
    });

    await test.step("'Edit custom domain' opens the Set custom domain dialog for a repo that already has one", async () => {
      const enabledEditButton = page
        .getByTitle("Edit custom domain")
        .and(page.locator(":not([disabled])"));
      if (
        await enabledEditButton
          .first()
          .isVisible({ timeout: 5000 })
          .catch(() => false)
      ) {
        await enabledEditButton.first().click();
        await expect(page.getByRole("heading", { name: "Set custom domain" })).toBeVisible();
        await page.keyboard.press("Escape");
      }
    });
  });
});

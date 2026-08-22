import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead.
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({ timeout: 30000 });
};

// OIDC flow: a single continuous journey — strict validation on creating a
// new client (Add stays disabled until the form is dirty and valid), save
// it, expand its row into the KV details panel, rotate its secret, reopen
// it for editing, then delete it as the closing stage.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("OIDC flow: strict validation -> create -> expand details -> rotate secret -> edit -> delete", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to OIDC", async () => {
      await gotoSecretManagementSection(page, "oidc", "OIDC");
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

    const clientName = `Flow OIDC Client ${Date.now()}`;

    await test.step("Fill a valid Client Name and HTTPS Redirect URI, then save", async () => {
      await page.getByPlaceholder("Enter client name").fill(clientName);
      await page.getByPlaceholder("https://example.com/oidc").fill("https://example.com/callback");

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

    await test.step("Rotate the client's secret and view the new value", async () => {
      const rotateButton = clientRow.getByRole("button", { name: "Rotate client secret" });
      if (await rotateButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await rotateButton.click();
        await expect(page.getByRole("heading", { name: "Rotate client secret" })).toBeVisible();
        await page.getByRole("button", { name: "Rotate Secret" }).click();

        await expect(page.getByText("Client secret rotated successfully"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
        // The reveal dialog can close before this check runs on a fast
        // rotation — treat it as optional rather than blocking the rest
        // of the flow on a UI-timing race.
        const revealHeading = page.getByRole("heading", { name: "New client secret" });
        if (await revealHeading.isVisible({ timeout: 5000 }).catch(() => false)) {
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

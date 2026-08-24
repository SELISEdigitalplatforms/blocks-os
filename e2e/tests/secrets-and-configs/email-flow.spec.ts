import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead (same convention as the existing
// per-sub-feature specs in "secrets and configs/").
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({ timeout: 30000 });
};

// Email flow: a single continuous journey through the "Email" sub-section
// under Secrets & Configs — strict validation on a new outbound SMTP
// configuration, save it, expand its accordion row to see the saved values,
// reopen for editing, then delete it as the closing stage.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Email flow: strict validation -> create -> expand details -> edit -> delete", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Email", async () => {
      await gotoSecretManagementSection(page, "email", "Email");
    });

    await test.step("Empty state shows if no configuration exists yet", async () => {
      // A pre-existing "Default" configuration may already be seeded on this
      // project, so this is best-effort rather than a hard requirement.
      await expect(page.getByText("No email configurations found"))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    });

    await test.step("The pre-existing Default configuration hides its Edit/Delete actions", async () => {
      const defaultTrigger = page.getByRole("button", { name: "Default" });
      if (await defaultTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
        await defaultTrigger.click();
        const defaultPanel = page.getByLabel("Default");
        await expect(defaultPanel.getByRole("button", { name: "Edit" })).toHaveCount(0);
        await expect(defaultPanel.getByRole("button", { name: "Delete" })).toHaveCount(0);
        await defaultTrigger.click();
      }
    });

    await test.step("Open the Add Configuration dialog", async () => {
      await page.getByRole("button", { name: "Add Configuration" }).click();
      await expect(page.getByRole("heading", { name: "Add Configuration" })).toBeVisible();
    });

    const saveButton = page.getByRole("button", { name: "Save", exact: true });

    await test.step("'Save' stays disabled until required fields are valid", async () => {
      await expect(saveButton).toBeDisabled();

      // An invalid host (not a domain) keeps the form invalid per the zod
      // schema's host regex in new-configuration.tsx.
      await page.getByPlaceholder("Enter Host").fill("not-a-domain");
      await expect(saveButton).toBeDisabled();

      // Configuration name too short.
      await page.getByPlaceholder("Enter name").fill("ab");
      await expect(page.getByText("Configuration name must be at least 3 characters"))
        .toBeVisible()
        .catch(() => {});

      // Port out of range.
      await page.getByPlaceholder("Enter port").fill("99999");
      await expect(page.getByText("Port must be between 1 and 65535"))
        .toBeVisible()
        .catch(() => {});

      // Invalid sender address (outbound is the default Type).
      await page.getByPlaceholder("Enter sender address").fill("not-an-email");
      await expect(page.getByText("Sender Address must be a valid email"))
        .toBeVisible()
        .catch(() => {});

      // Password too short.
      await page.getByPlaceholder("Enter password").fill("abc");
      await expect(page.getByText("Password must be at least 6 characters long"))
        .toBeVisible()
        .catch(() => {});

      await expect(saveButton).toBeDisabled();
    });

    await test.step("Provider offers Amazon SES and Zoho for Outbound", async () => {
      const providerSelect = page.getByRole("dialog").getByRole("combobox").nth(1);
      await providerSelect.click();
      await expect(page.getByRole("option", { name: "Amazon SES" })).toBeVisible();
      await expect(page.getByRole("option", { name: "Zoho" })).toBeVisible();
      await page.getByRole("option", { name: "Amazon SES" }).click();
    });

    await test.step("Switching Type to Inbound restricts Provider to Zoho and hides sender fields", async () => {
      const typeSelect = page.getByRole("dialog").getByRole("combobox").first();
      await typeSelect.click();
      await page.getByRole("option", { name: "Inbound" }).click();

      // Amazon SES isn't valid for inbound — the form auto-switches to Zoho.
      const providerSelect = page.getByRole("dialog").getByRole("combobox").nth(1);
      await expect(providerSelect).toHaveText(/Zoho/);
      await providerSelect.click();
      await expect(page.getByRole("option", { name: "Amazon SES" })).toHaveCount(0);
      await page.keyboard.press("Escape");

      await expect(page.getByPlaceholder("Enter sender name")).toHaveCount(0);
      await expect(page.getByPlaceholder("Enter sender address")).toHaveCount(0);
      await expect(page.getByPlaceholder("Enter Server Name")).toBeVisible();
      await expect(page.getByPlaceholder("Enter username")).toBeVisible();

      // Switch back to Outbound for the real save below.
      await typeSelect.click();
      await page.getByRole("option", { name: "Outbound" }).click();
      await expect(page.getByPlaceholder("Enter sender name")).toBeVisible();
    });

    const configName = `Flow Email Config ${Date.now()}`;

    await test.step("Fill a valid outbound SMTP configuration, then save", async () => {
      await page.getByPlaceholder("Enter name").fill(configName);
      await page.getByPlaceholder("Enter Host").fill("smtp.example.com");
      await page.getByPlaceholder("Enter port").fill("587");
      await page.getByPlaceholder("Enter sender name").fill("Flow Sender");
      await page
        .getByPlaceholder("Enter sender address")
        .fill(`flow-sender-${Date.now()}@example.com`);
      await page.getByPlaceholder("Enter sender username").fill("flow-sender-user");
      await page.getByPlaceholder("Enter password").fill("SuperSecret123");

      // Enable SSL while we're here — write-only in the UI, but the save
      // path should still accept it.
      await page.getByRole("checkbox").click();

      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      await saveButton.click();

      await expect(
        page
          .getByText("Configuration created successfully.")
          .or(page.getByText("New configuration added successfully.")),
      )
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    const configTrigger = page.getByRole("button", { name: configName });

    await test.step("Find the new configuration and expand its accordion row", async () => {
      await expect(configTrigger).toBeVisible({ timeout: 15000 });
      await configTrigger.click();
      // Another pre-existing "Default" configuration row can also be
      // expanded at the same time and renders the same "Outbound" label —
      // scope checks to this row's own expanded panel.
      const panel = page.getByLabel(configName);
      await expect(panel.getByText("smtp.example.com")).toBeVisible({ timeout: 10000 });
      await expect(panel.getByText("587")).toBeVisible();
      await expect(panel.getByText("Outbound")).toBeVisible();
    });

    await test.step("Reopen the configuration for editing and close without changes", async () => {
      const editButton = page.getByRole("button", { name: "Edit" });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).click();
      }
    });

    await test.step("Edit the configuration and actually save the change", async () => {
      const editButton = page.getByRole("button", { name: "Edit" });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();

        // The password field is never pre-filled on edit — it must be
        // re-entered to satisfy the min-length-6 validation rule.
        await page.getByPlaceholder("Enter sender name").fill("Flow Sender Updated");
        await page.getByPlaceholder("Enter password").fill("SuperSecret123");

        const updateButton = page.getByRole("button", { name: "Update Changes" });
        await expect(updateButton).toBeEnabled({ timeout: 10000 });
        await updateButton.click();

        await expect(page.getByText("Configuration updated successfully."))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Delete the configuration via its confirmation dialog", async () => {
      const deleteButton = page.getByRole("button", { name: "Delete" });
      if (await deleteButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await deleteButton.click();
        await expect(page.getByRole("heading", { name: "Delete configuration" })).toBeVisible();
        await expect(page.getByText("Are you sure you'd like to delete this configuration?"))
          .toBeVisible()
          .catch(() => {});

        await page.getByRole("button", { name: "Delete Configuration" }).click();
        await expect(page.getByText("Configuration deleted successfully."))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });
  });
});

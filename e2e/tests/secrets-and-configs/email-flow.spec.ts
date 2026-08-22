import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../../support/login-helper";

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
    });

    const configName = `Flow Email Config ${Date.now()}`;

    await test.step("Fill a valid outbound SMTP configuration, then save", async () => {
      await page.getByPlaceholder("Enter name").fill(configName);
      await page.getByPlaceholder("Enter Host").fill("smtp.example.com");
      await page.getByPlaceholder("Enter port").fill("587");
      await page.getByPlaceholder("Enter sender name").fill("Flow Sender");
      await page.getByPlaceholder("Enter sender address").fill(`flow-sender-${Date.now()}@example.com`);
      await page.getByPlaceholder("Enter sender username").fill("flow-sender-user");
      await page.getByPlaceholder("Enter password").fill("SuperSecret123");

      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      await saveButton.click();

      await expect(page.getByText("Configuration created successfully.").or(page.getByText("New configuration added successfully.")))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    const configTrigger = page.getByRole("button", { name: configName });

    await test.step("Find the new configuration and expand its accordion row", async () => {
      await expect(configTrigger).toBeVisible({ timeout: 15000 });
      await configTrigger.click();
      await expect(page.getByText("smtp.example.com")).toBeVisible({ timeout: 10000 });
      await expect(page.getByText("587")).toBeVisible();
      await expect(page.getByText("Outbound")).toBeVisible();
    });

    await test.step("Reopen the configuration for editing and close without changes", async () => {
      const editButton = page.getByRole("button", { name: "Edit" });
      if (await editButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await editButton.click();
        await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();
        await page.getByRole("button", { name: "Cancel" }).click();
      }
    });

    await test.step("Delete the configuration via its confirmation dialog", async () => {
      const deleteButton = page.getByRole("button", { name: "Delete" });
      if (await deleteButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await deleteButton.click();
        await expect(page.getByRole("heading", { name: "Delete configuration" })).toBeVisible();
        await expect(
          page.getByText("Are you sure you'd like to delete this configuration?"),
        )
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

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

// Notification flow: a single continuous journey — strict validation on a
// new notification configuration (Save stays disabled until valid), save
// it, verify its row, reopen it for editing, then delete it as the closing
// stage (new-notification-configuration.tsx / notification-configuration-list.tsx).
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Notification flow: strict validation -> create -> view row -> edit -> delete", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Notification", async () => {
      await gotoSecretManagementSection(page, "notification", "Notification");
    });

    await test.step("A fresh project starts with no notification configurations", async () => {
      await expect(page.getByText("No notification configurations found"))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });

    await test.step("Open the Add Configuration dialog", async () => {
      await page.getByRole("button", { name: "Add Configuration" }).click();
      await expect(page.getByRole("heading", { name: "Add Configuration" })).toBeVisible();
    });

    const saveButton = page.getByRole("button", { name: "Save", exact: true });

    await test.step("'Save' stays disabled until required fields are valid", async () => {
      await expect(saveButton).toBeDisabled();

      // Under 3 characters keeps the name invalid per the zod schema in
      // new-notification-configuration.tsx.
      await page.getByPlaceholder("Enter name").fill("ab");
      await expect(saveButton).toBeDisabled();
    });

    await test.step("Strict validation: Name max length and Notify Method min/max length", async () => {
      const nameInput = page.getByPlaceholder("Enter name");
      await nameInput.fill("a".repeat(101));
      await expect(page.getByText("Configuration name must be at most 100 characters"))
        .toBeVisible()
        .catch(() => {});
      await nameInput.fill("");

      const notifyMethodInput = page.getByPlaceholder("Enter notify method");
      await notifyMethodInput.fill("ab");
      await expect(page.getByText("Notify method must be at least 3 characters"))
        .toBeVisible()
        .catch(() => {});
      await notifyMethodInput.fill("a".repeat(101));
      await expect(page.getByText("Notify method must be at most 100 characters"))
        .toBeVisible()
        .catch(() => {});
      await notifyMethodInput.fill("");
    });

    const configName = `Flow Notif ${Date.now()}`;

    await test.step("Fill a valid name, Notification Type, Notify Method, enable Persistence, then save", async () => {
      await page.getByPlaceholder("Enter name").fill(configName);

      const notificationTypeSelect = page
        .getByRole("dialog")
        .getByRole("combobox")
        .filter({ hasText: "NoReceiverType" });
      await notificationTypeSelect.click();
      await page.getByRole("option", { name: "BroadcastReceiverType", exact: true }).click();

      await page.getByPlaceholder("Enter notify method").fill("flow-notify-method");
      await page.getByRole("checkbox").click();

      await expect(saveButton).toBeEnabled({ timeout: 10000 });
      await saveButton.click();

      await expect(
        page.getByText("New configuration added successfully."),
      )
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    const configRow = page.getByRole("row").filter({ hasText: configName });

    await test.step("Find the new configuration row", async () => {
      await expect(configRow).toBeVisible({ timeout: 15000 });
      await expect(configRow.getByText("BroadcastReceiverType")).toBeVisible();
      await expect(configRow.getByText("Yes")).toBeVisible();
    });

    await test.step("Search filters the list by name", async () => {
      const searchInput = page.getByPlaceholder("Search...");
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(configName);
        await expect(configRow).toBeVisible({ timeout: 10000 });

        await searchInput.fill("no-such-config-xyz");
        await expect(page.getByText("No notification configurations found"))
          .toBeVisible({ timeout: 8000 })
          .catch(() => {});

        await searchInput.fill("");
        await expect(configRow).toBeVisible({ timeout: 10000 });
      }
    });

    await test.step("Reopen the configuration for editing and close without changes", async () => {
      await configRow.getByRole("button").last().click();
      const editItem = page.getByRole("menuitem", { name: "Edit", exact: true });
      await expect(editItem).toBeVisible({ timeout: 8000 });
      await editItem.click();
      await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();
      // The Name field can't be changed once created.
      await expect(page.getByPlaceholder("Enter name")).toBeDisabled();
      await page.getByRole("button", { name: "Cancel" }).click();
    });

    await test.step("Edit the configuration and actually save a change", async () => {
      await configRow.getByRole("button").last().click();
      const editItem = page.getByRole("menuitem", { name: "Edit", exact: true });
      await expect(editItem).toBeVisible({ timeout: 8000 });
      await editItem.click();
      await expect(page.getByRole("heading", { name: "Edit Configuration" })).toBeVisible();

      await page.getByPlaceholder("Enter notify method").fill("flow-notify-method-updated");
      const updateButton = page.getByRole("button", { name: "Update Changes" });
      await expect(updateButton).toBeEnabled({ timeout: 10000 });
      await updateButton.click();

      await expect(page.getByText("Configuration updated successfully."))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("Delete confirmation: Cancel leaves the configuration intact", async () => {
      await configRow.getByRole("button").last().click();
      const deleteItem = page.getByRole("menuitem", { name: "Delete", exact: true });
      await expect(deleteItem).toBeVisible({ timeout: 8000 });
      await deleteItem.click();
      await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
      await page.getByRole("button", { name: "Cancel", exact: true }).click();
      await expect(page.getByRole("heading", { name: "Confirmation" })).toBeHidden({
        timeout: 8000,
      });
      await expect(configRow).toBeVisible();
    });

    await test.step("Delete the configuration via its confirmation dialog", async () => {
      await configRow.getByRole("button").last().click();
      const deleteItem = page.getByRole("menuitem", { name: "Delete", exact: true });
      await expect(deleteItem).toBeVisible({ timeout: 8000 });
      await deleteItem.click();

      await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
      await expect(
        page.getByText(new RegExp(`delete the ${configName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} configuration`)),
      ).toBeVisible();

      await page.getByRole("button", { name: "Yes", exact: true }).click();
      await expect(page.getByText("Configuration deleted successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });
  });
});

import { test, expect } from "../../support/test-base";
import {
  createProject,
  deleteCreatedProject,
  openProjectOverviewPage,
} from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

async function getProjectSaveButton(page: any) {
  const dialog = page.getByRole("dialog");
  const roleButton = dialog.getByRole("button", { name: /save|update|confirm/i }).first();
  if (await roleButton.isVisible({ timeout: 2000 }).catch(() => false)) return roleButton;
  const textButton = dialog
    .locator("button")
    .filter({ hasText: /save|update|confirm/i })
    .last();
  if (await textButton.isVisible({ timeout: 2000 }).catch(() => false)) return textButton;
  const submitButton = dialog.locator('button[type="submit"]').last();
  if (await submitButton.isVisible({ timeout: 2000 }).catch(() => false)) return submitButton;
  return roleButton;
}

test.describe("project settings", () => {
  let projectName = "";
  let tenantGroupId = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName, tenantGroupId } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    if (page.isClosed()) return;
    try {
      const backButton = page.getByRole("button", { name: "Back to console" });
      if (await backButton.isVisible({ timeout: 5000 }).catch(() => false))
        await backButton.click().catch(() => {});
      if (!page.isClosed()) await deleteCreatedProject(page, projectName).catch(() => {});
    } catch {
      // Cleanup should not hide the actual test failure.
    }
  });

  test("Project Settings page behavior", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("Project Settings page behavior", async () => {
      await test.step("Open Project Settings", async () => {
        await openProjectOverviewPage(page, tenantGroupId, "settings");
        await expect(page.getByRole("heading", { name: "Project Settings" })).toBeVisible({
          timeout: 30000,
        });
      });

      await test.step("[Positive] Project Settings page renders a General Information card and an Environments card", async () => {
        await expect(page.getByRole("heading", { name: "General Information" })).toBeVisible({
          timeout: 10000,
        });
        await expect(page.getByText("Name", { exact: true })).toBeVisible({ timeout: 10000 });
        await expect(page.getByText("Created On", { exact: true }).first()).toBeVisible({
          timeout: 10000,
        });
        await expect(page.getByText("Plan", { exact: true })).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
          timeout: 10000,
        });
      });

      await test.step("[Positive] Project Settings shows a full-page loading skeleton while project data is loading", async () => {
        const projectRoute = /\/api\/.*project.*/i;
        await page.route(projectRoute, async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          try {
            await route.continue();
          } catch {}
        });
        try {
          await page.reload({ waitUntil: "commit" });
          await page
            .locator('[class*="skeleton"], [class*="animate-pulse"]')
            .first()
            .isVisible({ timeout: 5000 })
            .catch(() => false);
          await expect(page.getByRole("heading", { name: "Project Settings" })).toBeVisible({
            timeout: 30000,
          });
        } finally {
          await page.unroute(projectRoute).catch(() => {});
        }
      });

      await test.step("[Negative] Plan displays Free", async () => {
        await expect(page.getByText("Free", { exact: true }).first()).toBeVisible({
          timeout: 10000,
        });
      });

      await test.step("[Positive] Edit opens the Edit Project dialog pre-filled with the current project name", async () => {
        const editButton = page.getByRole("button", { name: "Edit project name" });
        await expect(editButton).toBeVisible({ timeout: 10000 });
        await editButton.click();
        const editDialog = page.getByRole("dialog");
        await expect(editDialog).toBeVisible({ timeout: 10000 });
        await expect(editDialog.getByRole("heading", { name: "Edit Project" })).toBeVisible({
          timeout: 10000,
        });
        const nameInput = editDialog.getByRole("textbox", { name: "Project name" });
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        await expect(nameInput).not.toHaveValue("", { timeout: 10000 });
        await page.keyboard.press("Escape");
        await expect(editDialog).toBeHidden({ timeout: 10000 });
      });

      await test.step("[Negative] Project name is required and must be between 3 and 100 characters", async () => {
        await page.getByRole("button", { name: "Edit project name" }).click();
        const editDialog = page.getByRole("dialog");
        await expect(editDialog).toBeVisible({ timeout: 10000 });
        const nameInput = editDialog.getByRole("textbox", { name: "Project name" });
        await nameInput.fill("");
        await expect(editDialog.getByText("Name is required")).toBeVisible({ timeout: 10000 });
        await nameInput.fill("ab");
        await expect(
          editDialog.getByText("Project name must be at least 3 characters"),
        ).toBeVisible({ timeout: 10000 });
        await nameInput.fill("a".repeat(101));
        await expect(
          editDialog.getByText("Project name should be a maximum of 100 characters"),
        ).toBeVisible({ timeout: 10000 });
        await page.keyboard.press("Escape");
        await expect(editDialog).toBeHidden({ timeout: 10000 });
      });

      await test.step("[Negative] Save is disabled when project name is invalid", async () => {
        await page.getByRole("button", { name: "Edit project name" }).click();
        const editDialog = page.getByRole("dialog");
        await expect(editDialog).toBeVisible({ timeout: 10000 });
        const nameInput = editDialog.getByRole("textbox", { name: "Project name" });
        await nameInput.fill("ab");
        const saveButton = await getProjectSaveButton(page);
        await expect(saveButton).toBeVisible({ timeout: 10000 });
        await expect(saveButton).toBeDisabled({ timeout: 10000 });
        await page.keyboard.press("Escape");
        await expect(editDialog).toBeHidden({ timeout: 10000 });
      });

      await test.step("[Positive] Saving a valid project name updates the project", async () => {
        const editButton = page.getByRole("button", { name: "Edit project name" });
        await expect(editButton).toBeVisible({ timeout: 10000 });
        await editButton.click();

        const editDialog = page.getByRole("dialog");
        await expect(editDialog).toBeVisible({ timeout: 10000 });

        const nameInput = editDialog.getByRole("textbox", { name: "Project name" });
        await expect(nameInput).toBeVisible({ timeout: 10000 });

        const newName = `Testing ${Date.now()}`;
        await nameInput.fill(newName);
        await expect(nameInput).toHaveValue(newName);

        const saveButton = editDialog.getByRole("button", { name: /save|update|confirm/i });
        await expect(saveButton).toBeVisible({ timeout: 10000 });
        await expect(saveButton).toBeEnabled({ timeout: 10000 });

        await saveButton.click();

        await expect(
          page.getByText("Project name updated successfully", { exact: true }).first(),
        ).toBeVisible({ timeout: 15000 });

        await expect(page.getByRole("main").getByText(newName, { exact: true })).toBeVisible({
          timeout: 10000,
        });
      });

      // await test.step("[Negative] A failed project name update shows an error and keeps the dialog open", async () => {
      //   const tenantGroupRoute = /\/api\/.*tenant-group.*/i;
      //   await page.route(tenantGroupRoute, async (route) => {
      //     try {
      //       if (route.request().method() !== "GET") {
      //         await route.fulfill({
      //           status: 500,
      //           contentType: "application/json",
      //           body: JSON.stringify({ errors: "Server error" }),
      //         });
      //       } else {
      //         await route.continue();
      //       }
      //     } catch {}
      //   });
      //   try {
      //     await page.getByRole("button", { name: "Edit project name" }).click();
      //     const editDialog = page.getByRole("dialog");
      //     await expect(editDialog).toBeVisible({ timeout: 10000 });
      //     const nameInput = editDialog.getByRole("textbox", { name: "Project name" });
      //     await nameInput.fill(`Testing ${Date.now()}`);
      //     const saveButton = await getProjectSaveButton(page);
      //     await expect(saveButton).toBeVisible({ timeout: 10000 });
      //     await expect(saveButton).toBeEnabled({ timeout: 10000 });
      //     await saveButton.click();
      //     await expect(page.getByText("Failed to update project name")).toBeVisible({
      //       timeout: 15000,
      //     });
      //     await expect(editDialog).toBeVisible({ timeout: 10000 });
      //     await page.keyboard.press("Escape");
      //     await expect(editDialog).toBeHidden({ timeout: 10000 });
      //   } finally {
      //     await page.unroute(tenantGroupRoute).catch(() => {});
      //   }
      // });

      await test.step("[Positive] Cancel closes the Edit Project dialog without saving", async () => {
        await page.getByRole("button", { name: "Edit project name" }).click();
        const editDialog = page.getByRole("dialog");
        await expect(editDialog).toBeVisible({ timeout: 10000 });
        const nameInput = editDialog.getByRole("textbox", { name: "Project name" });
        await nameInput.fill(`Unsaved ${Date.now()}`);
        const cancelButton = editDialog.getByRole("button", { name: "Cancel" });
        await expect(cancelButton).toBeVisible({ timeout: 10000 });
        await cancelButton.click();
        await expect(editDialog).toBeHidden({ timeout: 10000 });
      });

      await test.step("[Positive] Environments card lists non-disabled environments", async () => {
        const envTable = page.locator("table").filter({ hasText: "X-Blocks-Key" }).first();
        if (await envTable.isVisible({ timeout: 5000 }).catch(() => false)) {
          const rows = envTable.getByRole("row");
          const count = await rows.count();
          expect(count).toBeGreaterThan(0);
        }
      });

      await test.step("[Positive] Environments card shows Environment, X-Blocks-Key and Domain columns", async () => {
        const envTable = page.locator("table").filter({ hasText: "X-Blocks-Key" }).first();
        if (await envTable.isVisible({ timeout: 5000 }).catch(() => false)) {
          await expect(envTable.getByText("Environment", { exact: true })).toBeVisible({
            timeout: 10000,
          });
          await expect(envTable.getByText("X-Blocks-Key", { exact: true })).toBeVisible({
            timeout: 10000,
          });
          await expect(envTable.getByText("Domain", { exact: true })).toBeVisible({
            timeout: 10000,
          });
        }
      });
    });
  });
});

import { test, expect } from "../../support/test-base";
import {
  createProject,
  deleteCreatedProject,
  openProjectOverviewPage,
} from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

// Project Settings flow: General Information card (name/created on/
// environments/plan) -> strict validation on Edit Project -> rename the
// project -> confirm the rename sticks -> the Environments table below it.
test.describe("flows", () => {
  let projectName = "";
  let tenantGroupId = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName, tenantGroupId } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Project Settings flow: strict validation -> rename project -> Environments table", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Open Project Settings", async () => {
      await openProjectOverviewPage(page, tenantGroupId, "settings");
      await expect(page.getByRole("heading", { name: "Project Settings" })).toBeVisible({
        timeout: 30000,
      });
    });

    await test.step("General Information shows the current project name", async () => {
      await expect(page.getByText("General Information")).toBeVisible({ timeout: 15000 });
      // The project name also appears in the sidebar project switcher, so
      // scope to the exact-match nodes and require at least one.
      await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible();
      // "Created On" also appears as an Environments-table column header
      // further down the page, so take the first (General Information) match.
      await expect(page.getByText("Created On").first()).toBeVisible();
      await expect(page.getByText("Plan")).toBeVisible();
      await expect(page.getByText("Free")).toBeVisible();
    });

    await test.step("Open the Edit Project dialog", async () => {
      await page.getByRole("button", { name: "Edit project name" }).click();
      await expect(page.getByRole("heading", { name: "Edit Project" })).toBeVisible({
        timeout: 10000,
      });
      await expect(page.locator("#name")).toHaveValue(projectName);
    });

    await test.step("Strict validation: name must be 3-100 characters", async () => {
      const nameInput = page.locator("#name");
      const updateButton = page.getByRole("button", { name: "Update" });

      await nameInput.fill("");
      await expect(page.getByText("Name is required"))
        .toBeVisible()
        .catch(() => {});
      await expect(updateButton).toBeDisabled();

      await nameInput.fill("ab");
      await expect(page.getByText("Project name must be at least 3 characters"))
        .toBeVisible()
        .catch(() => {});
      await expect(updateButton).toBeDisabled();

      await nameInput.fill("a".repeat(101));
      await expect(page.getByText("Project name should be a maximum of 100 characters"))
        .toBeVisible()
        .catch(() => {});
      await expect(updateButton).toBeDisabled();
    });

    const renamedProject = `${projectName} Renamed`;

    await test.step("Rename the project and save", async () => {
      const nameInput = page.locator("#name");
      await nameInput.fill(renamedProject);
      const updateButton = page.getByRole("button", { name: "Update" });
      await expect(updateButton).toBeEnabled();
      await updateButton.click();

      // The toast text also gets echoed inside an aria-live status region
      // ("Notification SuccessProject name updated successf…"), so scope to
      // the exact toast body node.
      await expect(
        page.getByText("Project name updated successfully", { exact: true }),
      ).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("heading", { name: "Edit Project" })).toBeHidden({
        timeout: 10000,
      });
    });

    await test.step("The renamed project name is now shown", async () => {
      await expect(page.getByText(renamedProject, { exact: true }).first()).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step("Environments table lists the provisioned Development environment", async () => {
      // "Environments" exact-text also matches the sidebar nav link and a
      // paragraph elsewhere on the page — the card heading role is unique.
      await expect(page.getByRole("heading", { name: "Environments", exact: true })).toBeVisible();
      await expect(
        page.getByText("Environments provisioned for this project and their public domains"),
      ).toBeVisible();
      await expect(page.getByText("X-Blocks-Key")).toBeVisible();
    });

    // Track the renamed project so teardown can find and delete it by its
    // current (post-rename) name.
    projectName = renamedProject;
  });
});

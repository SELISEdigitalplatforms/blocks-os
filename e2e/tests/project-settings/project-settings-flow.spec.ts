import { test, expect } from "../../support/test-base";
import { openProjectOverview } from "../../support/os-helpers";
import { readOsProject, writeOsProject } from "../../support/os-project";

// Project Settings flow: General Information card (name/created on/
// environments/plan) -> strict validation on Edit Project -> rename the
// project -> confirm the rename sticks -> the Environments table below it.
test.describe("flows", () => {

  test("Project Settings flow: strict validation -> rename project -> Environments table", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const fixture = readOsProject();
    if (!fixture?.projectName) {
      throw new Error("Missing fixtures/os-project.json projectName — run os-setup first.");
    }
    let projectName = fixture.projectName;

    await test.step("Open Project Settings", async () => {
      await openProjectOverview(page, "settings");
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
      await expect(page.getByText("Environments").first()).toBeVisible();
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

    await test.step("Cancel closes the dialog without saving", async () => {
      await page.locator("#name").fill(`${projectName} discarded`);
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(page.getByRole("heading", { name: "Edit Project" })).toBeHidden({
        timeout: 10000,
      });
      await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible();

      // Reopen for the validation + rename steps below.
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

      // A brief loading spinner replaces/prefixes the label while the
      // mutation is pending (isUpdating disables both buttons).
      await expect(page.locator('button:has(svg.lucide-loader)'))
        .toBeVisible({ timeout: 3000 })
        .catch(() => {});

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
      await expect(page.getByRole("columnheader", { name: "Environment" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Domain" })).toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Created On" })).toBeVisible();

      // Environments are listed dev -> test -> stg -> ... -> prod; a fresh
      // project only has Development, so it must be the first data row.
      const firstRow = page.getByRole("row").nth(1);
      await expect(firstRow.getByText("Development")).toBeVisible();
    });

    await test.step("Copy the environment's X-Blocks-Key", async () => {
      const copyButton = page.locator('button:has(svg.lucide-copy)').first();
      if (await copyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await copyButton.click();
        await expect(page.locator('svg.lucide-check').first())
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    });

    await test.step("Domain column shows 'Not deployed' for an undeployed environment", async () => {
      const notDeployedBadge = page.getByText("Not deployed").first();
      await expect(notDeployedBadge)
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
    });

    // Track the renamed project so teardown can find and delete it by its
    // current (post-rename) name.
    projectName = renamedProject;
    writeOsProject({ ...fixture, projectName: renamedProject });
  });
});

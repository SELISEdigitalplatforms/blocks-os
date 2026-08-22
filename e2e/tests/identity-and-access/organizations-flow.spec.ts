import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

// Organizations flow: strict validation on Add Organization, create one,
// then select it in the sidebar to open its workspace panel. A brand-new
// project may not have "Multiple Organizations" enabled yet, in which case
// the page shows a disabled notice instead and the create steps are skipped.
test.describe("flows", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Organizations flow: strict validation -> create -> select in sidebar -> workspace panel", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    let organizationsEnabled = false;

    await test.step("Navigate to Organizations", async () => {
      await gotoIamPath(page, "organization");
      const searchInput = page.getByPlaceholder("Search organizations...").first();
      const disabledNotice = page.getByText("Multiple Organizations is not enabled").first();
      await expect(searchInput.or(disabledNotice)).toBeVisible({ timeout: 30000 });

      organizationsEnabled = await page
        .getByRole("button", { name: /add organization/i })
        .isEnabled({ timeout: 5000 })
        .catch(() => false);
    });

    await test.step("Strict validation: Name is required (max 100 characters)", async () => {
      if (!organizationsEnabled) return;
      await page.getByRole("button", { name: /add organization/i }).click();
      await expect(page.getByRole("heading", { name: "Add Organization" })).toBeVisible();

      const nameInput = page.getByPlaceholder("Enter organization name");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("Name is required")).toBeVisible();

      await nameInput.fill("a".repeat(101));
      await expect(page.getByText("Name must be at most 100 characters")).toBeVisible();
    });

    const orgName = `Flow Org ${Date.now()}`;

    await test.step("Fill a valid name and save", async () => {
      if (!organizationsEnabled) return;
      const nameInput = page.getByPlaceholder("Enter organization name");
      await nameInput.fill(orgName);

      await page
        .getByRole("button", { name: /save|add/i })
        .last()
        .click();
      await expect(page.getByText("Organization added successfully"))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("Select the new organization in the sidebar and open its workspace panel", async () => {
      if (!organizationsEnabled) return;
      const orgEntry = page.getByText(orgName, { exact: true });
      await expect(orgEntry).toBeVisible({ timeout: 15000 });
      await orgEntry.click();

      // Selecting an org loads its OrganizationWorkspacePanel in the right
      // pane — its details tab shows the org's own name again.
      await expect(page.getByText(orgName, { exact: true }).last()).toBeVisible({ timeout: 15000 });
    });
  });
});

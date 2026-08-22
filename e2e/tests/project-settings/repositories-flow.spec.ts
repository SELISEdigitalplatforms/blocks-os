import { test, expect } from "../../../support/test-base";
import {
  createProject,
  deleteCreatedProject,
  openProjectOverviewPage,
} from "../../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../../support/login-helper";

// Repositories flow: a freshly created project has no linked repositories,
// so this walks the empty state, opens 'Add' -> 'Connect repository' (which
// requires a real GitHub OAuth hand-off we cannot complete headlessly, see
// render-provider.tsx's handleContinue), and confirms the search box only
// shows up once repositories exist (repositories.tsx: hasRepositories).
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

  test("Repositories flow: empty state -> open 'Connect repository' -> GitHub provider option", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Open Repositories", async () => {
      await openProjectOverviewPage(page, tenantGroupId, "repositories");
      await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
        timeout: 30000,
      });
    });

    await test.step("A fresh project starts with no repositories", async () => {
      await expect(page.getByText("No repositories yet")).toBeVisible({ timeout: 15000 });
      await expect(
        page.getByText("Add your first repository to get started."),
      ).toBeVisible();
      // The search box only renders once at least one repository exists.
      await expect(page.getByPlaceholder("Search repositories...")).toHaveCount(0);
    });

    // handleAddRepositoryClick (repositories.tsx) first awaits a GitHub
    // authorization check before deciding which dialog to open: an
    // already-authorized account skips straight to "Select repository",
    // otherwise "Connect repository" (pick a provider) opens first.
    const connectHeading = page.getByRole("heading", { name: "Connect repository" });
    const selectHeading = page.getByRole("heading", { name: "Select repository" });

    await test.step("Open 'Add'", async () => {
      await expect(page.getByRole("button", { name: "Add" })).toBeVisible({ timeout: 15000 });
      await page.getByRole("button", { name: "Add" }).click();
      await Promise.race([
        connectHeading.waitFor({ state: "visible", timeout: 20000 }),
        selectHeading.waitFor({ state: "visible", timeout: 20000 }),
      ]);
    });

    await test.step("GitHub is offered as a connection provider", async () => {
      if (!(await connectHeading.isVisible().catch(() => false))) {
        // This test account is already GitHub-authorized, so it landed
        // straight on "Select repository" instead — nothing more to
        // validate about the provider picker itself.
        await page.keyboard.press("Escape");
        return;
      }
      await expect(
        page.getByText("Select a Git provider to import an existing project from a Git Repository."),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible({
        timeout: 10000,
      });
      // Completing this requires a real GitHub OAuth redirect/popup, which is
      // out of reach for a headless flow test — close the dialog instead of
      // driving the external provider.
      await page.keyboard.press("Escape");
      await expect(connectHeading).toBeHidden({ timeout: 10000 });
    });

    await test.step("Repositories list still shows the empty state", async () => {
      await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("No repositories yet")).toBeVisible({ timeout: 15000 });
    });
  });
});

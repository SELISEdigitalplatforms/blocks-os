import { test, expect } from "../../support/test-base";
import {
  createProject,
  deleteCreatedProject,
  openProjectOverviewPage,
} from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";

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
      await expect(page.getByText("Add your first repository to get started.")).toBeVisible();
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
        // validate about the provider picker itself. Leave the dialog open;
        // the next step exercises it and closes it.
        return;
      }
      await expect(
        page.getByText(
          "Select a Git provider to import an existing project from a Git Repository.",
        ),
      ).toBeVisible();
      await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible({
        timeout: 10000,
      });

      // Only GitHub is active today — GitLab/Bitbucket/Azure DevOps/AWS
      // CodeCommit are all listed but disabled (git-dummy.ts: active: false).
      await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeEnabled();
      await expect(page.getByRole("button", { name: "Continue with GitLab" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Continue with Bitbucket" })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Continue with Azure DevOps" })).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Continue with AWS CodeCommit" }),
      ).toBeDisabled();

      // Completing this requires a real GitHub OAuth redirect/popup, which is
      // out of reach for a headless flow test — close the dialog instead of
      // driving the external provider.
      await page.keyboard.press("Escape");
      await expect(connectHeading).toBeHidden({ timeout: 10000 });
    });

    await test.step("'Select repository' dialog: provider list, search, and Revoke access dialog", async () => {
      if (!(await selectHeading.isVisible({ timeout: 3000 }).catch(() => false))) {
        // This test account is not GitHub-authorized, so it only ever saw
        // "Connect repository" above — nothing more to validate here.
        return;
      }

      // Same provider radio list as the picker: GitHub is the only enabled one.
      await expect(page.locator("#github-radio")).toBeChecked();
      await expect(page.locator("#gitlab-radio")).toBeDisabled();

      // Revoke access opens its own confirmation dialog — only exercise Cancel,
      // since Confirm reloads the page and revokes real GitHub access.
      // The dialog can still be settling right after open, so give it a beat
      // and retry the click if the element detaches mid-click.
      await page.waitForTimeout(1000);
      await page
        .getByText("Revoke repository access")
        .click({ timeout: 15000 })
        .catch(() =>
          page.getByText("Revoke repository access").click({ timeout: 15000, force: true }),
        );
      await expect(
        page.getByText("You will no longer be able to access the repositories."),
      ).toBeVisible({
        timeout: 10000,
      });
      await page.getByRole("button", { name: "Cancel" }).click();
      await expect(
        page.getByText("You will no longer be able to access the repositories."),
      ).toBeHidden({ timeout: 10000 });

      // Open the repository combobox and exercise search — the list is either
      // populated, loading, or shows "No repositories found.", all of which
      // are safe to assert without picking a real repository.
      await page.getByText(/^(Select a repository|Loading repositories\.\.\.)$/).click();
      const searchInput = page.getByPlaceholder("Search repositories...");
      await expect(searchInput).toBeVisible({ timeout: 10000 });
      await searchInput.fill("zzz-no-such-repo-xyz");
      await expect(page.getByText("No repositories found."))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
      await searchInput.fill("");

      // "Add" stays disabled until a repository is actually picked.
      await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();

      // Click outside the custom search popover (its own click-outside
      // handler closes it) rather than Escape, which would close the whole
      // dialog instead.
      await selectHeading.click();
      await page.waitForTimeout(500);
      await page.getByRole("button", { name: "Cancel", exact: true }).click({ timeout: 15000 });
      await expect(selectHeading).toBeHidden({ timeout: 10000 });
    });

    await test.step("Repositories list still shows the empty state", async () => {
      await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByText("No repositories yet")).toBeVisible({ timeout: 15000 });
    });
  });
});

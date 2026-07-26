import { test, expect } from "../../support/test-base";
import { resetFlowState, resolveProjectName, writeFlowState } from "../../support/flow-state";
import { openCreateProjectWizard } from "../../support/console";

// Sequential flow — step 1: create a project with 2 environments (Development,
// Testing). Saves the project name + tenantGroupId for the later steps.
// Runs authenticated via the saved login session (see playwright.config.ts).
//
// The name comes from E2E_PROJECT_NAME when set, otherwise e2e-<random>.

test("01 - create project with 2 environments", async ({ page }) => {
  // Drop any leftovers (project id, invited person) from a previous run so a
  // later step can never act on a stale project.
  resetFlowState();

  const projectName = resolveProjectName();
  const visible = { visible: true } as const;

  // Works from both the empty console and one that already has projects.
  await openCreateProjectWizard(page);

  // Step 1 — name + confirmations.
  await page.getByPlaceholder("Enter your project name").filter(visible).fill(projectName);
  const confirmations = page.getByRole("checkbox").filter(visible);
  await confirmations.nth(0).check();
  await confirmations.nth(1).check();
  await page.getByRole("button", { name: "Continue" }).filter(visible).click();

  // Step 2 — skip resources.
  await expect(page.getByRole("heading", { name: "Add resource" }).filter(visible)).toBeVisible();
  await page.getByRole("button", { name: "Continue" }).filter(visible).click();

  // Step 3 — pick Development + Testing (first two), submit.
  await expect(page.getByText("Select environments").filter(visible)).toBeVisible();
  const envs = page.getByRole("checkbox").filter(visible);
  await envs.nth(0).check(); // Development
  await envs.nth(1).check(); // Testing
  await page.getByRole("button", { name: "Submit" }).filter(visible).click();

  // Success → new project's environments page.
  await expect(page.getByText("Your project has been created.").first()).toBeVisible({
    timeout: 45_000,
  });
  await page.waitForURL("**/app/project/*/environments", { timeout: 45_000 });

  const tenantGroupId = page.url().match(/\/app\/project\/([^/]+)\/environments/)?.[1] ?? "";
  expect(tenantGroupId, "could not read tenantGroupId from URL").not.toBe("");

  writeFlowState({ projectName, tenantGroupId });
});

import { expect, type Page } from "@playwright/test";

// Helpers for the console page (/app/console).

/**
 * Open the create-project wizard from the console.
 *
 * The console has **two** entry points depending on whether the account already
 * has projects, and a run can hit either — the first run of the day starts on an
 * empty console, and step 06 empties it again:
 *
 *   - no projects  → the "Welcome to SELISE Blocks" panel with a
 *                    "Create a project" button (console-create.tsx)
 *   - ≥ 1 project  → the "Add Project" card in the project grid
 *                    (add-project-card.tsx)
 *
 * Both call the same `useCreateProjectRedirect().handleClick` and land on
 * /app/create-project, so either is a valid way in — take whichever rendered.
 */
export async function openCreateProjectWizard(page: Page): Promise<void> {
  await page.goto("/app/console");

  const entryPoint = page
    .getByRole("button", { name: "Create a project", exact: true })
    .or(page.getByText("Add Project", { exact: true }))
    .filter({ visible: true });

  await expect(
    entryPoint.first(),
    'no way into the create-project wizard: expected either the "Create a project" welcome button (empty console) or the "Add Project" card',
  ).toBeVisible({ timeout: 30_000 });

  await entryPoint.first().click();
  await page.waitForURL("**/app/create-project", { timeout: 30_000 });
}

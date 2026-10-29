import { expect, type Page } from "@playwright/test";
import { openProjectOverview } from "../../support/os-helpers";

export async function navigateToRepositoriesFlow(page: Page) {
  await openProjectOverview(page, "repositories");
  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
    timeout: 30000,
  });
}

export async function verifyEmptyStateFlow(page: Page) {
  await expect(page.getByText("No repositories yet")).toBeVisible({ timeout: 15000 });
  await expect(page.getByText("Add your first repository to get started.")).toBeVisible();
  await expect(page.getByPlaceholder("Search repositories...")).toHaveCount(0);
}

function repositoryRows(page: Page) {
  // Data rows only: the header row has column headers, not cells.
  return page.getByRole("table").getByRole("row").filter({ has: page.getByRole("cell") });
}

/** The repositories a project shows: [] for the empty state, else the connected names. */
export type RepositoriesState = string[];

/**
 * A project shows the "No repositories yet" empty state until a repository is
 * connected, and the connected list after that. The shared E2E project has
 * had one connected since 12/10/2026, so assert whichever the project is in:
 * the empty state when none is connected, otherwise the list with each
 * repository row and its controls. Waits for one of the two to render
 * instead of reading the page before the list has loaded.
 */
export async function verifyEmptyStateOrConnectedListFlow(page: Page): Promise<RepositoriesState> {
  const emptyState = page.getByText("No repositories yet");
  const firstRow = repositoryRows(page).first();
  await expect(emptyState.or(firstRow)).toBeVisible({ timeout: 15000 });

  if ((await repositoryRows(page).count()) === 0) {
    await verifyEmptyStateFlow(page);
    return [];
  }

  await expect(emptyState).toHaveCount(0);
  await expect(page.getByPlaceholder("Search repositories...")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add repository" })).toBeEnabled();
  for (const header of ["Name", "Repo Link", "Source", "Created", "Actions"]) {
    await expect(page.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
  }

  const rows = repositoryRows(page);
  const names: string[] = [];
  for (let i = 0; i < (await rows.count()); i++) {
    const row = rows.nth(i);
    const cells = row.getByRole("cell");
    await expect(cells).toHaveCount(5);
    const name = (await cells.nth(0).innerText()).trim();
    expect(name, `repository row ${i + 1} has a name`).toMatch(/^\S+\/\S+$/);
    await expect(cells.nth(1)).toHaveText(/^https?:\/\/\S+$/);
    const link = (await cells.nth(1).innerText()).trim();
    expect(link.endsWith(`/${name}`), `repository link ${link} points at ${name}`).toBe(true);
    await expect(cells.nth(2)).not.toBeEmpty();
    await expect(cells.nth(3)).toHaveText(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
    const removeButton = row.getByRole("button", { name: `Remove ${name}`, exact: true });
    await expect(removeButton).toBeVisible();
    await expect(removeButton).toBeEnabled();
    names.push(name);
  }
  return names;
}

/** After the dialogs close, the page shows the same state it started in. */
export async function verifyRepositoriesUnchangedFlow(page: Page, before: RepositoriesState) {
  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
    timeout: 15000,
  });
  if (before.length === 0) {
    await expect(page.getByText("No repositories yet")).toBeVisible({ timeout: 15000 });
    return;
  }
  await expect(page.getByText("No repositories yet")).toHaveCount(0);
  await expect(repositoryRows(page)).toHaveCount(before.length, { timeout: 15000 });
  for (const name of before) {
    await expect(
      repositoryRows(page).filter({ has: page.getByRole("cell", { name, exact: true }) }),
    ).toHaveCount(1);
  }
}

export type RepositoryDialogKind = "connect" | "select";

export async function openAddRepositoryDialogFlow(page: Page): Promise<RepositoryDialogKind> {
  const addButton = page.getByRole("button", { name: "Add repository" });
  await expect(addButton).toBeVisible({ timeout: 15_000 });
  await addButton.click();

  // Click runs refetchAuthorization() and then opens Connect (not authorized)
  // or Select (already authorized). useValidateAuthorization() also fetches
  // isAuthorized on page mount — waiting for that URL after click can resolve
  // on the leftover mount request, then Promise.race(15s) loses while the
  // click's refetch is still in flight. Wait for the dialog the click opens.
  const connectHeading = page.getByRole("heading", { name: "Connect repository" });
  const selectHeading = page.getByRole("heading", { name: "Select repository" });
  await expect(connectHeading.or(selectHeading)).toBeVisible({ timeout: 45_000 });

  return (await connectHeading.isVisible()) ? "connect" : "select";
}

export async function verifyConnectRepositoryProviderFlow(page: Page): Promise<boolean> {
  const connectHeading = page.getByRole("heading", { name: "Connect repository" });
  if (!(await connectHeading.isVisible())) {
    return false;
  }
  await expect(
    page.getByText(
      "Select a Git provider to import an existing project from a Git Repository.",
    ),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeVisible({
    timeout: 10000,
  });

  await expect(page.getByRole("button", { name: "Continue with GitHub" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Continue with GitLab" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue with Bitbucket" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Continue with Azure DevOps" })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Continue with AWS CodeCommit" }),
  ).toBeDisabled();

  await page.keyboard.press("Escape");
  await expect(connectHeading).toBeHidden({ timeout: 10000 });
  return true;
}

export async function exerciseSelectRepositoryDialogFlow(
  page: Page,
): Promise<boolean> {
  const selectHeading = page.getByRole("heading", { name: "Select repository" });
  if (!(await selectHeading.isVisible({ timeout: 3000 }))) {
    return false;
  }

  await expect(page.locator("#github-radio")).toBeChecked();
  await expect(page.locator("#gitlab-radio")).toBeDisabled();

  await page.waitForTimeout(1000);
  const revokeTrigger = page.getByText("Revoke repository access");
  try {
    await revokeTrigger.click({ timeout: 15_000 });
  } catch {
    await revokeTrigger.click({ timeout: 15_000, force: true });
  }
  await expect(
    page.getByText("You will no longer be able to access the repositories."),
  ).toBeVisible({ timeout: 10000 });
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(
    page.getByText("You will no longer be able to access the repositories."),
  ).toBeHidden({ timeout: 10000 });

  await page.getByText(/^(Select a repository|Loading repositories\.\.\.)$/).click();
  const searchInput = page.getByPlaceholder("Search repositories...");
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill("zzz-no-such-repo-xyz");
  if (await page.getByText("No repositories found.").isVisible({ timeout: 10000 })) {
    await expect(page.getByText("No repositories found.")).toBeVisible();
  }
  await searchInput.fill("");

  await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();

  await selectHeading.click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: "Cancel", exact: true }).click({ timeout: 15000 });
  await expect(selectHeading).toBeHidden({ timeout: 10000 });
  return true;
}

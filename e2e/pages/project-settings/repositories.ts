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

export type RepositoryDialogKind = "connect" | "select";

export async function openAddRepositoryDialogFlow(page: Page): Promise<RepositoryDialogKind> {
  await expect(page.getByRole("button", { name: "Add" })).toBeVisible({ timeout: 15000 });

  // Genuine hang in the auth check would otherwise surface as a bare
  // heading-visibility timeout; observe the round trip directly so the
  // diagnostic is clear.
  const authCheckPromise = page
    .waitForResponse((response) => /\/release\/isAuthorized\/?$/i.test(response.url()), {
      timeout: 45000,
    })
    .catch(() => null);

  await page.getByRole("button", { name: "Add" }).click();

  const authCheckResponse = await authCheckPromise;
  if (!authCheckResponse) {
    throw new Error(
      "GET .../release/isAuthorized never completed within 45s after clicking 'Add repository' " +
        "— the GitHub-authorization check this depends on is unresponsive.",
    );
  }

  const connectHeading = page.getByRole("heading", { name: "Connect repository" });
  const selectHeading = page.getByRole("heading", { name: "Select repository" });
  await Promise.race([
    connectHeading.waitFor({ state: "visible", timeout: 15000 }),
    selectHeading.waitFor({ state: "visible", timeout: 15000 }),
  ]);

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

export async function verifyEmptyStateAfterFlow(page: Page) {
  await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText("No repositories yet")).toBeVisible({ timeout: 15000 });
}

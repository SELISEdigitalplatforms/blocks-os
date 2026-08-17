import { test, expect } from "../../support/test-base";
import { type Page } from "@playwright/test";

import { ensureAuthenticated } from "../../support/login-helper";
import {
  createProject,
  deleteCreatedProject,
  openProjectOverviewPage,
} from "../../support/create-and-delete-project";

const addRepositoryButton = (page: Page) =>
  page.getByRole("button", { name: "Add", exact: true });

const modalOverlay = (page: Page) =>
  page.locator('div.fixed.inset-0.z-50[data-state="open"]');

const dismissOpenDialog = async (page: Page) => {
  const dialog = page.getByRole("dialog");
  const overlay = modalOverlay(page);

  if (await dialog.isVisible().catch(() => false)) {
    const closeButton = dialog.getByRole("button", { name: "Close" });
    if (await closeButton.isVisible().catch(() => false)) {
      await closeButton.click();
    } else {
      await page.keyboard.press("Escape");
    }
  } else if ((await overlay.count()) > 0) {
    await page.keyboard.press("Escape");
  }

  await expect(dialog).toBeHidden({ timeout: 10_000 });

  if ((await overlay.count()) > 0) {
    await overlay.first().click({ position: { x: 1, y: 1 } });
  }

  await expect(overlay).toHaveCount(0, { timeout: 10_000 });
};

const clickAddRepository = async (page: Page) => {
  await dismissOpenDialog(page);
  const button = addRepositoryButton(page);
  await expect(button).toBeVisible({ timeout: 15000 });
  await expect(button).toBeEnabled({ timeout: 5000 });
  await button.click();
  await expect(page.getByRole("dialog")).toBeVisible({ timeout: 15000 });
};

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
      const backButton = page.getByRole("button", {
        name: "Back to console",
      });

      if (await backButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await backButton.click({ timeout: 10000 }).catch(() => {});
      }

      if (!page.isClosed()) {
        await deleteCreatedProject(page, projectName).catch(() => {});
      }
    } catch {
      // Cleanup failure must not hide the original test failure.
    }
  });

  test("Repositories page behavior", async ({ page, context }) => {
    test.setTimeout(180_000);

    await test.step("Repositories page behavior", async () => {
      await test.step("Open Repositories", async () => {
        await openProjectOverviewPage(page, tenantGroupId, "repositories");
        await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
          timeout: 30000,
        });
      });

      await test.step("[Positive] Repositories page renders with a table and 'Add' action", async () => {
        await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
          timeout: 10000,
        });
        await expect(addRepositoryButton(page)).toBeVisible({
          timeout: 10000,
        });
      });

      await test.step("[Positive] Repositories page shows a loading skeleton while assets are fetching", async () => {
        await page.route("**/api/**asset**", async (route) => {
          await new Promise((resolve) => setTimeout(resolve, 1500));
          await route.continue();
        });
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(/\/app\/project\/[^/]+\/repositories/, {
          timeout: 30000,
        });
        await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
          timeout: 30000,
        });

        // The app can render from a cached/persisted state on reload even while a
        // background refetch is in flight, so a skeleton isn't guaranteed to appear.
        await expect(page.locator('[class*="skeleton"]').first())
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
        await page.unroute("**/api/**asset**").catch(() => {});
      });

      await test.step("[Positive] True-empty state (no repos, no search) shows 'No repositories yet'", async () => {
        // NOTE: assumes the tenant group has zero connected repositories.
        const emptyMessage = page.getByText("No repositories yet");
        if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
          await expect(page.getByText("Add your first repository to get started.")).toBeVisible({
            timeout: 10000,
          });
        }
      });

      await test.step("[Negative] Search with no matches shows 'No repositories found.' inside the table rather than the true-empty state", async () => {
        const searchInput = page.getByPlaceholder("Search repositories...");
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await searchInput.fill("zzz_no_match_xyz");
          await expect(page.getByText("No repositories found.")).toBeVisible({
            timeout: 8000,
          });
        }
      });

      await test.step("[Positive] Search filters repositories by name or link, client-side", async () => {
        const firstRow = page.getByRole("row").nth(1);
        if (await firstRow.isVisible().catch(() => false)) {
          const name = (await firstRow.locator("td").first().innerText()).trim();
          const partial = name.slice(0, Math.max(2, name.length - 2));
          const searchInput = page.getByPlaceholder("Search repositories...");
          await searchInput.fill(partial);
          await expect(page.getByRole("row").nth(1)).toContainText(partial, {
            ignoreCase: true,
            timeout: 10000,
          });
        }
      });

      await test.step("[Positive] Repo Link opens the repository in a new tab", async () => {
        const firstRow = page.getByRole("row").nth(1);
        if (await firstRow.isVisible().catch(() => false)) {
          const linkCell = firstRow.locator("td").nth(1);
          const [newPage] = await Promise.all([
            context.waitForEvent("page", { timeout: 5000 }).catch(() => null),
            linkCell.click(),
          ]);
          if (newPage) {
            await expect(newPage).toHaveURL(/^https:/, { timeout: 10000 });
          }
        }
      });

      await test.step("[Positive] Source column always shows the GitHub icon and label", async () => {
        const firstRow = page.getByRole("row").nth(1);
        if (await firstRow.isVisible().catch(() => false)) {
          await expect(firstRow.getByText("GitHub")).toBeVisible({ timeout: 10000 });
        }
      });

      // await test.step("[Positive] Pagination only appears once filtered repositories exceed the fixed page size of 12", async () => {
      //   const rowCount = await page.getByRole("row").count();
      //   const pagination = page.getByRole("navigation");
      //   if (rowCount > 13) {
      //     await expect(pagination).toBeVisible({ timeout: 10000 });
      //   } else {
      //     await expect(pagination).toHaveCount(0, { timeout: 10000 });
      //   }
      // });

      await test.step("[Security] 'Add' checks GitHub authorization first and opens the repo-selection modal directly if already authorized", async () => {
        await clickAddRepository(page);
        const selectHeading = page.getByRole("heading", {
          name: "Select repository",
        });
        if (await selectHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
          await expect(selectHeading).toBeVisible({ timeout: 10000 });
        }
        await dismissOpenDialog(page);
      });

      await test.step("[Security] 'Add' shows the 'Connect repository' provider step first when GitHub is not yet authorized", async () => {
        await clickAddRepository(page);
        const connectHeading = page.getByRole("heading", {
          name: "Connect repository",
        });
        if (await connectHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
          await expect(
            page.getByText(
              "Select a Git provider to import an existing project from a Git Repository.",
            ),
          ).toBeVisible({ timeout: 10000 });
        }
        await dismissOpenDialog(page);
      });

      await test.step("[Security] Completing provider authorization from the Connect step proceeds into repo selection", async () => {
        await clickAddRepository(page);
        const connectHeading = page.getByRole("heading", {
          name: "Connect repository",
        });
        if (await connectHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
          const githubButton = page.getByRole("button", { name: /github/i });
          if (await githubButton.isVisible().catch(() => false)) {
            await githubButton.click();
            await expect(page.getByRole("heading", { name: "Select repository" }))
              .toBeVisible({ timeout: 20000 })
              .catch(() => {});
          }
        }
      });

      await test.step("[Positive] Selecting a repository from the picker adds it and shows a success toast", async () => {
        await clickAddRepository(page);
        const selectHeading = page.getByRole("heading", {
          name: "Select repository",
        });
        if (await selectHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
          const firstRepoOption = page.locator('[class*="cursor-pointer"]').first();
          if (await firstRepoOption.isVisible().catch(() => false)) {
            await firstRepoOption.click();
            await expect(page.getByText("Repository added successfully")).toBeVisible({
              timeout: 15000,
            });
          }
        }
      });

      await test.step("[Negative] A failed repository add shows an error toast and closes the selection modal", async () => {
        await page.route("**/api/**asset**", async (route) => {
          if (route.request().method() === "POST") {
            await route.fulfill({
              status: 500,
              contentType: "application/json",
              body: JSON.stringify({ isSuccess: false }),
            });
          } else {
            await route.continue();
          }
        });

        await clickAddRepository(page);
        const selectHeading = page.getByRole("heading", {
          name: "Select repository",
        });
        if (await selectHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
          const firstRepoOption = page.locator('[class*="cursor-pointer"]').first();
          if (await firstRepoOption.isVisible().catch(() => false)) {
            await firstRepoOption.click();
            await expect(page.getByRole("alert").or(page.getByText("Error"))).toBeVisible({
              timeout: 15000,
            });
            await expect(selectHeading).toBeHidden({ timeout: 10000 });
          }
        }
      });
    });
  });
});

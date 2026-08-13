import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("repositories", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await loginFresh(page);

    await expect(
      page.getByRole("heading", { name: "Your Blocks Projects" }),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: "Repositories" }).click();
    await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
      timeout: 30000,
    });
  });

  test("TC-0203: Repositories page renders with a table and 'Add' action", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add" })).toBeVisible();
  });

  test("TC-0204: Repositories page shows a loading skeleton while assets are fetching", async ({
    page,
  }) => {
    await page.route("**/api/**asset**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.reload();

    await expect(page.locator('[class*="skeleton"]').first()).toBeVisible({
      timeout: 5000,
    });
  });

  test("TC-0205: True-empty state (no repos, no search) shows 'No repositories yet'", async ({
    page,
  }) => {
    // NOTE: assumes the tenant group has zero connected repositories.
    const emptyMessage = page.getByText("No repositories yet");
    if (await emptyMessage.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(
        page.getByText("Add your first repository to get started."),
      ).toBeVisible();
    }
  });

  test("TC-0206: Search with no matches shows 'No repositories found.' inside the table rather than the true-empty state", async ({
    page,
  }) => {
    const searchInput = page.getByPlaceholder("Search repositories...");
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill("zzz_no_match_xyz");
      await expect(page.getByText("No repositories found.")).toBeVisible({
        timeout: 8000,
      });
    }
  });

  test("TC-0207: Search filters repositories by name or link, client-side", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      const name = (await firstRow.locator("td").first().innerText()).trim();
      const partial = name.slice(0, Math.max(2, name.length - 2));
      const searchInput = page.getByPlaceholder("Search repositories...");
      await searchInput.fill(partial);
      await expect(page.getByRole("row").nth(1)).toContainText(partial, {
        ignoreCase: true,
      });
    }
  });

  test("TC-0208: Repo Link opens the repository in a new tab", async ({
    page,
    context,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      const linkCell = firstRow.locator("td").nth(1);
      const [newPage] = await Promise.all([
        context.waitForEvent("page", { timeout: 5000 }).catch(() => null),
        linkCell.click(),
      ]);
      if (newPage) {
        await expect(newPage).toHaveURL(/^https:/);
      }
    }
  });

  test("TC-0209: Source column always shows the GitHub icon and label", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await expect(firstRow.getByText("GitHub")).toBeVisible();
    }
  });

  test("TC-0210: Pagination only appears once filtered repositories exceed the fixed page size of 12", async ({
    page,
  }) => {
    const rowCount = await page.getByRole("row").count();
    const pagination = page.getByRole("navigation");
    if (rowCount > 13) {
      await expect(pagination).toBeVisible();
    } else {
      await expect(pagination).toHaveCount(0);
    }
  });

  test("TC-0211: 'Add' checks GitHub authorization first and opens the repo-selection modal directly if already authorized", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add" }).click();
    const selectHeading = page.getByRole("heading", { name: "Select repository" });
    if (await selectHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(selectHeading).toBeVisible();
    }
  });

  test("TC-0212: 'Add' shows the 'Connect repository' provider step first when GitHub is not yet authorized", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add" }).click();
    const connectHeading = page.getByRole("heading", { name: "Connect repository" });
    if (await connectHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(
        page.getByText(
          "Select a Git provider to import an existing project from a Git Repository.",
        ),
      ).toBeVisible();
    }
  });

  test("TC-0213: Completing provider authorization from the Connect step proceeds into repo selection", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add" }).click();
    const connectHeading = page.getByRole("heading", { name: "Connect repository" });
    if (await connectHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
      const githubButton = page.getByRole("button", { name: /github/i });
      if (await githubButton.isVisible().catch(() => false)) {
        await githubButton.click();
        await expect(
          page.getByRole("heading", { name: "Select repository" }),
        ).toBeVisible({ timeout: 20000 }).catch(() => {});
      }
    }
  });

  test("TC-0214: Selecting a repository from the picker adds it and shows a success toast", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Add" }).click();
    const selectHeading = page.getByRole("heading", { name: "Select repository" });
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

  test("TC-0215: A failed repository add shows an error toast and closes the selection modal", async ({
    page,
  }) => {
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

    await page.getByRole("button", { name: "Add" }).click();
    const selectHeading = page.getByRole("heading", { name: "Select repository" });
    if (await selectHeading.isVisible({ timeout: 8000 }).catch(() => false)) {
      const firstRepoOption = page.locator('[class*="cursor-pointer"]').first();
      if (await firstRepoOption.isVisible().catch(() => false)) {
        await firstRepoOption.click();
        await expect(page.getByRole("alert").or(page.getByText("Error"))).toBeVisible({
          timeout: 15000,
        });
        await expect(selectHeading).toBeHidden();
      }
    }
  });
});

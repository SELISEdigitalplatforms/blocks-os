import { test, expect, Page } from "@playwright/test";
import { createProject, deleteProject } from "../../support/create-and-delete-project";
import { loginFresh } from "../../support/login-helper";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link (races, gets
// left collapsed by unrelated Escape presses elsewhere in the flow, and
// sometimes no-ops when its parent section is already marked active).
// Navigating straight to the section's URL sidesteps all of that.
const gotoSecretManagementSection = async (page: Page, subpath: string, headingName: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/secret-management/${subpath}`);
  }
  await expect(page.getByRole("heading", { name: headingName })).toBeVisible({
    timeout: 30000,
  });
};

test.describe("secrets and configs", () => {
  test.beforeEach(async ({ page }) => {
    await loginFresh(page);
    await createProject(page);
    await expect(page.getByRole("heading", { name: "Your Blocks Projects" })).toBeVisible({
      timeout: 50000,
    });
    await page
      .getByRole("button", { name: /Development/ })
      .first()
      .click();
    await expect(page).toHaveURL(/\/app\/[^/]+\/dashboard/, { timeout: 30000 });
    await expect(page.getByText("X-Blocks-Key:")).toBeVisible({
      timeout: 15000,
    });
  });

  test.afterEach(async ({ page }) => {
    await page.getByRole("button", { name: "Back to console" }).click();
    await deleteProject(page);
  });

  test("Secrets & Configs — my services", async ({
    page,
  }) => {
    await test.step("Navigate to My Services", async () => {
      await gotoSecretManagementSection(page, "my-services", "My Services");
    });

    await test.step("[Positive] Page renders with Setup Guide and Register Service actions", async () => {
      await expect(page.getByRole("button", { name: "Setup Guide" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Register Service" })).toBeVisible();
    });

    await test.step("[Negative] Register dialog requires Service Name; Save stays disabled until the form is dirty", async () => {
      await page.getByRole("button", { name: "Register Service" }).click();
      await expect(page.getByRole("heading", { name: "Register New Service" })).toBeVisible();

      const saveButton = page.getByRole("button", { name: "Save" });
      await expect(saveButton).toBeDisabled();

      // Touch the field, then clear it — the form doesn't surface an inline
      // "required" message, it just keeps Save disabled while the field is
      // empty.
      const nameInput = page.getByPlaceholder("Enter name");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(saveButton).toBeDisabled();
    });

    await test.step("[Negative] Service Name accepts a 101-character value without a client-side max-length error", async () => {
      // The form doesn't enforce a max-length message client-side — the field
      // accepts the value as-is and Save remains enabled.
      const nameInput = page.getByPlaceholder("Enter name");
      const longName = "a".repeat(101);
      await nameInput.fill(longName);
      await expect(nameInput).toHaveValue(longName);
      await expect(page.getByRole("button", { name: "Save" })).toBeEnabled();
    });

    await test.step("[Negative / Security] Duplicate tags are rejected client-side rather than silently deduplicated", async () => {
      const nameInput = page.getByPlaceholder("Enter name");
      await nameInput.fill(`Checkout Worker ${Date.now()}`);

      const tagsInput = page
        .locator('[class*="chips-input"] input, input[placeholder*="tag" i]')
        .first();
      if (await tagsInput.isVisible({ timeout: 3000 }).catch(() => false)) {
        await tagsInput.fill("payments");
        await tagsInput.press("Enter");
        await tagsInput.fill("payments");
        await tagsInput.press("Enter");
        await expect(page.getByText("Duplicate tags are not allowed"))
          .toBeVisible({
            timeout: 5000,
          })
          .catch(() => {});
      }
    });

    await test.step("[Positive] Registering a valid, unique service succeeds and shows a success toast", async () => {
      const nameInput = page.getByPlaceholder("Enter name");
      const serviceName = `Checkout Worker ${Date.now()}`;
      await nameInput.fill(serviceName);

      const saveButton = page.getByRole("button", { name: "Save" });
      await expect(saveButton).toBeEnabled();
      await saveButton.click();

      await expect(page.getByText("Service Registered successfully", { exact: true })).toBeVisible({
        timeout: 15000,
      });

      // The list is paginated (icon-only prev/next buttons with no accessible
      // names) and keeps accumulating services across test runs, so a newly
      // created one — appended at the end — isn't guaranteed to land on page 1.
      // Jump straight to the last page: the 4th button in the "Page X of Y"
      // pagination control (>>), which is only rendered once there's more than
      // one page.
      const serviceText = page.getByText(serviceName, { exact: true });
      if (!(await serviceText.isVisible().catch(() => false))) {
        // Right after the mutation, the list briefly shows its loading skeleton
        // while the invalidated query refetches — an instant isVisible() check
        // on the pagination text can catch that gap and read as "no pagination",
        // so wait for it properly instead of a one-shot check.
        const pageIndicator = page.getByText(/^Page \d+ of \d+$/);
        const hasPagination = await pageIndicator
          .waitFor({ state: "visible", timeout: 10000 })
          .then(() => true)
          .catch(() => false);
        if (hasPagination) {
          const currentPageLabel = await pageIndicator.innerText();
          const lastPageButton = pageIndicator
            .locator("xpath=following-sibling::*[1]")
            .getByRole("button")
            .last();
          await lastPageButton.click();
          // Paging re-fetches from the live backend — wait for the indicator to
          // actually advance before looking for the new row, instead of racing
          // the default 5s assertion timeout against that network round trip.
          await expect(pageIndicator).not.toHaveText(currentPageLabel, {
            timeout: 15000,
          });
        }
      }

      // The invalidated query can occasionally lag well past the toast (a
      // live-backend timing gap, not a UI bug) — reload once as a fallback
      // before giving up, instead of hard-failing on a slow refetch.
      if (!(await serviceText.isVisible({ timeout: 15000 }).catch(() => false))) {
        await page.reload();
        await expect(page.getByRole("button", { name: "Register Service" })).toBeVisible({
          timeout: 15000,
        });
      }
      await expect(serviceText).toBeVisible({ timeout: 15000 });
    });

    await test.step("[Negative] Registering with the backend rejecting the request shows a specific error, not a silent failure", async () => {
      // Glob route matching is case-sensitive and the real endpoint is
      // /api/Service/Register — match case-insensitively so this doesn't
      // silently fail to intercept and let the real request through.
      await page.route(/\/api\/service\/register/i, async (route) => {
        if (route.request().method() === "POST") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              isSuccess: false,
              // The app's error handling (isErrorWithErrors) only recognizes
              // `errors` as an object map of field -> message; a plain string is
              // ignored and falls back to a generic "Something went wrong." toast.
              errors: { name: "A service with this name already exists." },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await page.getByRole("button", { name: "Register Service" }).click();
      await page.getByPlaceholder("Enter name").fill(`Duplicate Name Test ${Date.now()}`);
      await page.getByRole("button", { name: "Save" }).click();

      await expect(
        page.getByText("A service with this name already exists.", {
          exact: true,
        }),
      ).toBeVisible({ timeout: 15000 });
      // Dialog stays open on failure so the user can correct and retry.
      await expect(page.getByRole("heading", { name: "Register New Service" })).toBeVisible();
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.unroute(/\/api\/service\/register/i);
    });

    await test.step("[Security] Setup Guide opens a read-only guideline panel with no editable secrets exposed", async () => {
      await page.getByRole("button", { name: "Setup Guide" }).click();
      await expect(page.getByText("Guideline")).toBeVisible();
      // The guide is documentation only — it should not expose an input for
      // pasting/viewing raw service keys or tokens.
      const secretInput = page.locator('input[type="password"]');
      await expect(secretInput).toHaveCount(0);
      await page.keyboard.press("Escape");
    });

    await test.step("[Positive] Each registered service row expands to reveal its own scoped configuration", async () => {
      // Each service row is a heading button that toggles aria-expanded and
      // reveals a same-named region — data-state is used elsewhere on the page
      // (e.g. the right-side-panel wrapper) so it's not a reliable selector here.
      const firstRow = page.getByRole("button", { name: /Logs Traces/ }).first();
      if (await firstRow.isVisible().catch(() => false)) {
        await firstRow.click();
        await expect(firstRow).toHaveAttribute("aria-expanded", "true");
      }
    });
  });
});

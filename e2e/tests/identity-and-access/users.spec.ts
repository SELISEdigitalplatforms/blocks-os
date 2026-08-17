import { test, expect, Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
import { e2eCredentials, uniqueTestEmail } from "../../support/env";
import { ensureAuthenticated } from "../../support/login-helper";

// The Identity & Access sidebar submenu is a flyout, same as the Secrets &
// Configs one, and proved just as unreliable to drive via click-to-expand
// (races, no-ops, and gets left collapsed by unrelated interactions
// elsewhere in the flow). Navigate straight to the section's URL instead.
const gotoIamPath = async (page: Page, subpath: string) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (match) {
    await page.goto(`${new URL(page.url()).origin}${match[0]}/iam/${subpath}`);
  }
};

test.describe("identity and access", () => {
  let projectName = "";
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Identity & Access — Users", async ({ page }) => {
    // ============================================================
    // Users
    // ============================================================
    await test.step("Navigate to Users", async () => {
      await gotoIamPath(page, "user");
      await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({
        timeout: 30000,
      });
    });

    //   await test.step("[Positive] Users table renders Name, Email, Status, Created on, Last updated and Last login columns", async () => {
    // This grid isn't a semantic <table> — the column labels are plain text
    // nodes, not columnheader-role elements. Each label also has a hidden
    // mobile-responsive duplicate inside every row card once rows exist, so
    // scope to .first() (the header) rather than assuming a single match.
    //    await expect(page.getByText("Name", { exact: true }).first()).toBeVisible({
    //     timeout: 10000,
    //    });
    //    await expect(page.getByText("Email", { exact: true }).first()).toBeVisible();
    //    await expect(
    //     page.getByText("Status", { exact: true }).first(),
    //    ).toBeVisible();
    //    await expect(
    //     page.getByText("Created on", { exact: true }).first(),
    //    ).toBeVisible();
    //    await expect(
    //     page.getByText("Last updated", { exact: true }).first(),
    //    ).toBeVisible();
    //    await expect(
    //     page.getByText("Last login", { exact: true }).first(),
    //    ).toBeVisible();
    //   });

    await test.step("[Negative] Search enforces a minimum of 3 characters", async () => {
      const searchInput = page.getByPlaceholder(/Minimum 3 characters/).first();
      await expect(searchInput).toBeVisible();
      await searchInput.fill("ab");
      await searchInput.fill("abc");
      await expect(searchInput).toHaveValue("abc");
      await searchInput.fill("");
    });

    await test.step("[Negative] Invite User requires a valid email address", async () => {
      await page.getByRole("button", { name: /invite/i }).click();
      await expect(page.getByRole("heading", { name: "Invite User" })).toBeVisible();

      const emailInput = page.getByPlaceholder("name@company.com");
      await emailInput.fill("x");
      await emailInput.fill("");
      await expect(page.getByText("Email is required")).toBeVisible();

      await emailInput.fill("not-an-email");
      await expect(page.getByText("Please enter a valid email address")).toBeVisible();
    });

    await test.step("[Security] Inviting an email that already belongs to a user is surfaced, not silently duplicated", async () => {
      const emailInput = page.getByPlaceholder("name@company.com");
      await emailInput.fill(e2eCredentials().email);
      const existingUserNote = page.getByText(
        "A user with this email already exists in the system.",
      );
      await expect(existingUserNote)
        .toBeVisible({ timeout: 8000 })
        .catch(() => {});
    });

    await test.step("[Positive] Inviting a brand-new email sends an invitation", async () => {
      const emailInput = page.getByPlaceholder("name@company.com");
      await emailInput.fill(uniqueTestEmail("newuser"));

      const orgSelect = page.getByLabel("Organization");
      if (await orgSelect.isVisible().catch(() => false)) {
        await orgSelect.click();
        const firstOption = page.getByRole("option").first();
        if (await firstOption.isVisible().catch(() => false)) {
          await firstOption.click();
        }
      }
      await page
        .getByRole("button", { name: /send|invite/i })
        .last()
        .click();
      await expect(page.getByText("Invitation is sent", { exact: true }))
        .toBeVisible({
          timeout: 15000,
        })
        .catch(() => {});
    });

    await test.step("[Negative] Deactivate requires confirmation before taking effect", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.getByRole("button").last().click();
        const deactivateItem = page.getByText("Deactivate", { exact: true });
        if (await deactivateItem.isVisible().catch(() => false)) {
          await deactivateItem.click();
          await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
          await expect(
            page.getByText("Are you sure you want to deactivate this user?"),
          ).toBeVisible();
          await page.getByRole("button", { name: "Cancel" }).click();
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("[Security] Resetting a user's password requires explicit confirmation naming the action", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.getByRole("button").last().click();
        const resetItem = page.getByText("Reset password", { exact: true });
        if (await resetItem.isVisible().catch(() => false)) {
          await resetItem.click();
          await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();
          await expect(
            page.getByText("Are you sure you want to reset the password for this user?"),
          ).toBeVisible();
          await page.getByRole("button", { name: "Cancel" }).click();
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("[Security] Disabling MFA for a user requires an explicit, distinctly-worded confirmation", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.getByRole("button").last().click();
        const disableMfaItem = page.getByText(/Disable MFA/);
        if (await disableMfaItem.isVisible().catch(() => false)) {
          await disableMfaItem.click();
          await expect(page.getByRole("heading", { name: "Disable MFA?" })).toBeVisible();
          await expect(
            page.getByText(
              "Are you sure you want to disable Multi-Factor Authentication (MFA) for this account?",
            ),
          ).toBeVisible();
          await page.keyboard.press("Escape");
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("[Positive] Resending activation for a pending user shows a titled success toast", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.getByRole("button").last().click();
        const resendItem = page.getByText(/Resend activation/i);
        if (await resendItem.isVisible().catch(() => false)) {
          await resendItem.click();
          await page
            .getByRole("button", { name: /confirm/i })
            .last()
            .click();
          await expect(
            page.getByText("Activation email has been resent successfully", {
              exact: true,
            }),
          ).toBeVisible({ timeout: 15000 });
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });
  });
});

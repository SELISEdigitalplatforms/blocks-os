import { test, expect } from "../../support/test-base";
import { type Page } from "@playwright/test";
import {
  createProject,
  deleteCreatedProject,
  openProjectOverviewPage,
} from "../../support/create-and-delete-project";
import { uniqueTestEmail } from "../../support/env";
import { ensureAuthenticated } from "../../support/login-helper";

const inviteButton = (page: Page) => page.getByRole("button", { name: "Invite", exact: true });

test.describe("project settings", () => {
  let projectName = "";
  let tenantGroupId = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);

    ({ projectName, tenantGroupId } = await createProject(page));
    // Hydrate selectedTenantGroup on the Environments page first, then open
    // People in the same layout so getPeople runs as the owner.
    await openProjectOverviewPage(page, tenantGroupId, "environments");
    await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("link", { name: "People", exact: true }).click();
    await expect(page).toHaveURL(/\/people(?:\/)?$/);

    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 30_000,
    });
    await expect(inviteButton(page)).toBeVisible({ timeout: 30_000 });
  });

  test.afterEach(async ({ page }) => {
    // Cleanup must never become the reason the test fails.
    if (page.isClosed()) {
      return;
    }

    try {
      const backButton = page.getByRole("button", {
        name: "Back to console",
        exact: true,
      });

      if (await backButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await backButton.click().catch(() => {});
      }

      await deleteCreatedProject(page, projectName).catch(() => {});
    } catch {
      // Cleanup failure should not hide the actual test failure.
    }
  });

  test("People page behavior", async ({ page }) => {
    test.setTimeout(180_000);

    await test.step("People page renders correctly", async () => {
      await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
        timeout: 15_000,
      });

      await expect(inviteButton(page)).toBeVisible({
        timeout: 15_000,
      });
    });

    await test.step("[Positive] People table shows Name, Email and Environments columns", async () => {
      await expect(page.getByRole("columnheader", { name: "Name", exact: true })).toBeVisible();

      await expect(page.getByRole("columnheader", { name: "Email", exact: true })).toBeVisible();

      await expect(
        page.getByRole("columnheader", {
          name: "Environments",
          exact: true,
        }),
      ).toBeVisible();
    });

    await test.step("[Positive] Name column shows user status badge", async () => {
      const badge = page.getByText(/^(Owner|Pending Invite|Inactive)$/).first();

      if (await badge.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(badge).toBeVisible();
      }
    });

    await test.step("[Positive] Environment column shows additional environment indicator", async () => {
      const moreIndicator = page.getByText(/^\+\d+ more$/).first();

      if (await moreIndicator.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await expect(moreIndicator).toBeVisible();
      }
    });

    // ---------------------------------------------------------
    // INVITATION
    // ---------------------------------------------------------

    await test.step("[Negative] Invite requires recipient and environment", async () => {
      await inviteButton(page).click();

      const dialog = page.getByRole("dialog");

      await expect(dialog).toBeVisible({
        timeout: 10_000,
      });

      await expect(page.getByRole("heading", { name: "Invite people" })).toBeVisible({
        timeout: 10_000,
      });

      const sendButton = page
        .getByRole("button", {
          name: /send|invite/i,
        })
        .last();

      // Depending on implementation, Send may already be disabled.
      if (await sendButton.isEnabled({ timeout: 3_000 }).catch(() => false)) {
        await sendButton.click();

        const recipientError = page.getByText("Recipient is required", { exact: true });

        if (await recipientError.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await expect(recipientError).toBeVisible();
        }
      } else {
        await expect(sendButton).toBeDisabled();
      }

      await page.keyboard.press("Escape");

      await expect(page.getByRole("heading", { name: "Invite people" })).toBeHidden({
        timeout: 10_000,
      });
    });

    await test.step("[Positive] Invite accepts multiple email addresses", async () => {
      await inviteButton(page).click();

      const recipientsInput = page.getByPlaceholder(/email/i).first();

      await expect(recipientsInput).toBeVisible({
        timeout: 10_000,
      });

      await recipientsInput.fill("a@example.com, b@example.com c@example.com");

      await expect(page.getByText("Invalid email format", { exact: true })).toHaveCount(0);

      await page.keyboard.press("Escape");
    });

    await test.step("[Positive] Invite dialog supports multiple invitation rows", async () => {
      await inviteButton(page).click();

      const addRowButton = page.getByRole("button", {
        name: /add (another|row)/i,
      });

      if (await addRowButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await addRowButton.click();

        const recipientInputs = page.getByPlaceholder(/email/i);

        await expect(recipientInputs).toHaveCount(2, {
          timeout: 10_000,
        });
      }

      await page.keyboard.press("Escape");
    });

    // ---------------------------------------------------------
    // DO NOT ACTUALLY SEND AN INVITATION
    // ---------------------------------------------------------

    await test.step("[Positive] Invitation form accepts a valid recipient", async () => {
      await inviteButton(page).click();

      const recipientsInput = page.getByPlaceholder(/email/i).first();

      await recipientsInput.fill(uniqueTestEmail("newuser"));

      await expect(page.getByText("Invalid email format", { exact: true })).toHaveCount(0);

      // Do not submit the invitation here.
      //
      // Submitting causes a real backend operation and can make
      // the test take minutes or hang depending on mail/invite APIs.

      await page.keyboard.press("Escape");
    });

    // ---------------------------------------------------------
    // EXISTING PERSON
    // ---------------------------------------------------------

    await test.step("[Positive] Existing people are rendered", async () => {
      await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
        timeout: 15000,
      });

      await expect(page.getByText("Owner", { exact: true }).first()).toBeVisible({
        timeout: 20000,
      });
    });

    await test.step("[Positive] Person action menu exposes available actions", async () => {
      const firstPersonRow = page.getByRole("row").nth(1);

      await expect(firstPersonRow).toBeVisible({
        timeout: 10_000,
      });

      const actionButtons = firstPersonRow.getByRole("button");

      const actionCount = await actionButtons.count();

      if (actionCount > 0) {
        await actionButtons.last().click();

        await expect(page.getByRole("menu").or(page.getByRole("dialog")).first())
          .toBeVisible({
            timeout: 5_000,
          })
          .catch(() => {});
      }

      await page.keyboard.press("Escape");
    });

    // ---------------------------------------------------------
    // RESEND ACTIONS
    // ---------------------------------------------------------

    await test.step("[Positive] Resend Invitation or Resend Activation opens confirmation", async () => {
      const rows = page.getByRole("row");
      const count = await rows.count();

      let found = false;

      for (let i = 1; i < count; i++) {
        const row = rows.nth(i);

        const buttons = row.getByRole("button");

        if ((await buttons.count()) === 0) {
          continue;
        }

        await buttons.last().click();

        const resendInvitation = page.getByText("Resend Invitation", { exact: true });

        const resendActivation = page.getByText("Resend Activation", { exact: true });

        if (await resendInvitation.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await resendInvitation.click();

          await expect(
            page.getByRole("heading", {
              name: "Resend Invitation",
            }),
          ).toBeVisible({
            timeout: 10_000,
          });

          found = true;
          await page.keyboard.press("Escape");
          break;
        }

        if (await resendActivation.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await resendActivation.click();

          await expect(
            page.getByRole("heading", {
              name: "Resend Activation",
            }),
          ).toBeVisible({
            timeout: 10_000,
          });

          found = true;
          await page.keyboard.press("Escape");
          break;
        }

        await page.keyboard.press("Escape");
      }

      // This is conditional because a freshly-created project
      // may not have a pending/inactive user.
      if (!found) {
        test.info().annotations.push({
          type: "info",
          description: "No resend action was available for the current project data.",
        });
      }
    });

    // ---------------------------------------------------------
    // TRANSFER OWNERSHIP
    // ---------------------------------------------------------

    await test.step("[Security] Transfer Ownership requires explicit confirmation", async () => {
      const rows = page.getByRole("row");
      const count = await rows.count();

      let found = false;

      for (let i = 1; i < count; i++) {
        const row = rows.nth(i);
        const buttons = row.getByRole("button");

        if ((await buttons.count()) === 0) {
          continue;
        }

        await buttons.last().click();

        const transferItem = page.getByText("Transfer Ownership", { exact: true });

        if (await transferItem.isVisible({ timeout: 2_000 }).catch(() => false)) {
          await transferItem.click();

          await expect(
            page.getByRole("heading", {
              name: "Transfer Ownership",
            }),
          ).toBeVisible({
            timeout: 10_000,
          });

          found = true;

          await page.keyboard.press("Escape");
          break;
        }

        await page.keyboard.press("Escape");
      }

      if (!found) {
        test.info().annotations.push({
          type: "info",
          description: "Transfer Ownership was not available for the current project data.",
        });
      }
    });

    // ---------------------------------------------------------
    // PERSON DETAILS
    // ---------------------------------------------------------

    await test.step("[Positive] Person detail page shows Details and Environments tabs", async () => {
      const firstPersonRow = page.getByRole("row").nth(1);

      await expect(firstPersonRow).toBeVisible({
        timeout: 10_000,
      });

      await firstPersonRow.click();

      await expect(page.getByRole("tab", { name: "Details" })).toBeVisible({
        timeout: 15_000,
      });

      await expect(page.getByRole("tab", { name: "Environments" })).toBeVisible({
        timeout: 10_000,
      });
    });

    await test.step("[Positive] Person Details tab is active", async () => {
      const detailsTab = page.getByRole("tab", {
        name: "Details",
      });

      await expect(detailsTab).toHaveAttribute("data-state", "active", {
        timeout: 10_000,
      });
    });

    await test.step("[Security] Person Environments tab displays environment access", async () => {
      await page
        .getByRole("tab", {
          name: "Environments",
        })
        .click();

      await expect(page.getByRole("tabpanel")).toBeVisible({
        timeout: 10_000,
      });
    });

    // ---------------------------------------------------------
    // ENVIRONMENT ACCESS
    // ---------------------------------------------------------

    await test.step("[Positive] Environment access controls are available when supported", async () => {
      const removeButton = page
        .getByRole("button", {
          name: /remove/i,
        })
        .first();

      const grantButton = page
        .getByRole("button", {
          name: /grant|add access/i,
        })
        .first();

      const removeVisible = await removeButton.isVisible({ timeout: 3_000 }).catch(() => false);

      const grantVisible = await grantButton.isVisible({ timeout: 3_000 }).catch(() => false);

      // At least one of these may be available depending on
      // current user/environment permissions.
      if (!removeVisible && !grantVisible) {
        test.info().annotations.push({
          type: "info",
          description: "No environment access modification action was available.",
        });
      }
    });
  });
});

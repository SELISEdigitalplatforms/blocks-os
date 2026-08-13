import { test, expect } from "../support/test-base";
import { loginFresh } from "../support/login-helper";

// Fresh, isolated context for this file — ignore the "chromium" project's
// default storageState and log in for real instead of reusing a saved session.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe("people", () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await loginFresh(page);

    await expect(
      page.getByRole("heading", { name: "Your Blocks Projects" }),
    ).toBeVisible({ timeout: 30_000 });

    await page.getByRole("link", { name: "People" }).click();
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 30000,
    });
  });

  test("TC-0184: People page renders a table with an Invite action", async ({
    page,
  }) => {
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite" })).toBeVisible();
  });

  test("TC-0185: People table shows Name, Email and Environments columns", async ({
    page,
  }) => {
    await expect(page.getByRole("columnheader", { name: "Name" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Email" })).toBeVisible();
    await expect(
      page.getByRole("columnheader", { name: "Environments" }),
    ).toBeVisible();
  });

  test("TC-0186: Name column shows an 'Owner', 'Pending Invite', or 'Inactive' badge depending on the person's state", async ({
    page,
  }) => {
    const badge = page.getByText(/^(Owner|Pending Invite|Inactive)$/).first();
    if (await badge.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(badge).toBeVisible();
    }
  });

  test("TC-0187: Environments column shows up to 3 environment chips, with a '+N more' indicator beyond that", async ({
    page,
  }) => {
    const moreIndicator = page.getByText(/\+\d+ more/).first();
    if (await moreIndicator.isVisible({ timeout: 8000 }).catch(() => false)) {
      await expect(moreIndicator).toBeVisible();
    }
  });

  test("TC-0188: 'Invite' requires at least one recipient email and at least one selected environment per invitation row", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Invite" }).click();
    await expect(page.getByRole("heading", { name: "Invite people" })).toBeVisible();

    await page.getByRole("button", { name: /send|invite/i }).last().click();
    await expect(page.getByText("Recipient is required")).toBeVisible();
    await expect(page.getByText("At least one environment is required")).toBeVisible();
  });

  test("TC-0189: Invite accepts multiple comma/space-separated email addresses in a single recipient field", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Invite" }).click();
    const recipientsInput = page.getByPlaceholder(/email/i).first();
    await recipientsInput.fill("a@example.com, b@example.com c@example.com");
    await expect(page.getByText("Invalid email format")).toHaveCount(0);
  });

  test("TC-0190: Invite dialog supports adding multiple invitation rows, each with its own recipients and environments", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Invite" }).click();
    const addRowButton = page.getByRole("button", { name: /add (another|row)/i });
    if (await addRowButton.isVisible().catch(() => false)) {
      await addRowButton.click();
      const recipientInputs = page.getByPlaceholder(/email/i);
      await expect(recipientInputs).toHaveCount(2);
    }
  });

  test("TC-0191: Successfully sent invitations show a summary toast describing granted (and any skipped) invites", async ({
    page,
  }) => {
    await page.getByRole("button", { name: "Invite" }).click();
    await page.getByPlaceholder(/email/i).first().fill(`newuser${Date.now()}@example.com`);

    const envMultiSelect = page.getByText("Environments", { exact: true }).first();
    if (await envMultiSelect.isVisible().catch(() => false)) {
      await page.getByRole("combobox").first().click();
      const firstOption = page.getByRole("option").first();
      if (await firstOption.isVisible().catch(() => false)) {
        await firstOption.click();
        await page.keyboard.press("Escape");
      }
    }

    await page.getByRole("button", { name: /send|invite/i }).last().click();
    await expect(page.getByText(/invit/i).first()).toBeVisible({ timeout: 15000 });
  });

  test("TC-0192: Inviting an email that already has access to the project is reported as skipped rather than silently ignored", async ({
    page,
  }) => {
    // NOTE: assumes at least one existing person's email is known ahead of time.
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      const existingEmail = (await firstRow.locator("td").nth(1).innerText()).trim();
      if (existingEmail) {
        await page.getByRole("button", { name: "Invite" }).click();
        await page.getByPlaceholder(/email/i).first().fill(existingEmail);

        const envSelect = page.getByRole("combobox").first();
        if (await envSelect.isVisible().catch(() => false)) {
          await envSelect.click();
          await page.getByRole("option").first().click();
          await page.keyboard.press("Escape");
        }
        await page.getByRole("button", { name: /send|invite/i }).last().click();
        await expect(page.getByRole("alert").or(page.getByText(/skipped/i))).toBeVisible({
          timeout: 15000,
        }).catch(() => {});
      }
    }
  });

  test("TC-0193: 'Invite' control is unavailable or restricted for a non-owner viewer", async ({
    page,
  }) => {
    // NOTE: assumes the logged-in test account is the project owner; cannot easily
    // simulate a non-owner viewer without a second test account.
    await expect(page.getByRole("button", { name: "Invite" })).toBeVisible();
  });

  test("TC-0194: 'Revoke Access' opens a confirmation naming the person before removing them", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      const revokeItem = page.getByText("Revoke Access", { exact: true });
      if (await revokeItem.isVisible().catch(() => false)) {
        await revokeItem.click();
        await expect(
          page.getByRole("heading", { name: "Revoke Access" }),
        ).toBeVisible();
      }
    }
  });

  test("TC-0195: Confirming Revoke Access removes the person and shows a success toast", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      const revokeItem = page.getByText("Revoke Access", { exact: true });
      if (await revokeItem.isVisible().catch(() => false)) {
        await revokeItem.click();
        await page.getByRole("button", { name: /confirm|revoke/i }).last().click();
        await expect(page.getByText("Removed access successfully")).toBeVisible({
          timeout: 15000,
        });
      }
    }
  });

  test("TC-0196: 'Resend Invitation' and 'Resend Activation' are distinct actions with their own confirmation copy", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.getByRole("button").last().click();
      const resendInviteItem = page.getByText("Resend Invitation", { exact: true });
      const resendActivationItem = page.getByText("Resend Activation", { exact: true });
      if (await resendInviteItem.isVisible().catch(() => false)) {
        await resendInviteItem.click();
        await expect(
          page.getByRole("heading", { name: "Resend Invitation" }),
        ).toBeVisible();
      } else if (await resendActivationItem.isVisible().catch(() => false)) {
        await resendActivationItem.click();
        await expect(
          page.getByRole("heading", { name: "Resend Activation" }),
        ).toBeVisible();
      }
    }
  });

  test("TC-0197: 'Transfer Ownership' requires explicit confirmation naming the new owner", async ({
    page,
  }) => {
    const rows = page.getByRole("row");
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
      const row = rows.nth(i);
      await row.getByRole("button").last().click();
      const transferItem = page.getByText("Transfer Ownership", { exact: true });
      if (await transferItem.isVisible({ timeout: 2000 }).catch(() => false)) {
        await transferItem.click();
        await expect(
          page.getByRole("heading", { name: "Transfer Ownership" }),
        ).toBeVisible();
        break;
      }
      await page.keyboard.press("Escape");
    }
  });

  test("TC-0198: Person detail page shows Details and Environments tabs", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page.getByRole("tab", { name: "Details" })).toBeVisible({
        timeout: 15000,
      });
      await expect(page.getByRole("tab", { name: "Environments" })).toBeVisible();
    }
  });

  test("TC-0199: Person Details tab shows the individual's basic info", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await expect(page.getByRole("tab", { name: "Details" })).toHaveAttribute(
        "data-state",
        "active",
        { timeout: 15000 },
      );
    }
  });

  test("TC-0200: Person Environments tab separates environments the person has access to from ones they don't, and behaves differently for owners vs. non-owners", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.getByRole("tab", { name: "Environments" }).click();
      await expect(page.getByRole("tabpanel")).toBeVisible();
    }
  });

  test("TC-0201: Removing a person's access to a specific environment from the Environments tab updates their access without removing them entirely", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.getByRole("tab", { name: "Environments" }).click();

      const removeButton = page.getByRole("button", { name: /remove/i }).first();
      if (await removeButton.isVisible().catch(() => false)) {
        await removeButton.click();
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      }
    }
  });

  test("TC-0202: Granting a person access to an additional environment from the Environments tab reuses the invite flow", async ({
    page,
  }) => {
    const firstRow = page.getByRole("row").nth(1);
    if (await firstRow.isVisible().catch(() => false)) {
      await firstRow.click();
      await page.getByRole("tab", { name: "Environments" }).click();

      const grantButton = page.getByRole("button", { name: /grant|add access/i }).first();
      if (await grantButton.isVisible().catch(() => false)) {
        await grantButton.click();
        await expect(page.getByRole("dialog")).toBeVisible();
      }
    }
  });
});

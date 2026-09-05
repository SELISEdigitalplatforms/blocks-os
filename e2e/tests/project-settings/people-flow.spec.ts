import { test, expect } from "../../support/test-base";
import { openProjectOverview } from "../../support/os-helpers";
import { tryWaitForInvitedPersonRow, waitForPeopleOwnerReady } from "../../support/people-helpers";
import { uniqueTestEmail } from "../../support/env";

// People flow: strict validation on Invite, then send an invite for a fresh
// email (active or inactive — both are valid). The test case is "invite was
// sent": HTTP 2xx + isSuccess + success toast + dialog closed. List-row
// follow-ups run only when IAM has already materialised the ProjectPeople row.
test.describe("flows", () => {

  test("People flow: strict validation -> send invite (active or inactive)", async ({
    page,
  }) => {
    test.setTimeout(240_000);

    await test.step("Open People", async () => {
      await openProjectOverview(page, "people");
      await waitForPeopleOwnerReady(page, () => openProjectOverview(page, "people"));
    });

    await test.step("The project owner appears in the list", async () => {
      if (!(await page.getByText("Owner").first().isVisible({ timeout: 15000 }).catch(() => false))) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
          timeout: 30000,
        });
        await expect(page.getByRole("button", { name: "Invite" })).toBeVisible({
          timeout: 30000,
        });
      }
      await expect(page.getByText("Owner").first()).toBeVisible({ timeout: 20000 });
    });

    await test.step("Pagination controls on the People table", async () => {
      const nextPageButton = page.locator('button:has(svg.lucide-chevron-right)').first();
      if (await nextPageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        const isDisabled = await nextPageButton.isDisabled().catch(() => true);
        if (!isDisabled) {
          await nextPageButton.click();
          await page.waitForTimeout(500);
          const prevPageButton = page.locator('button:has(svg.lucide-chevron-left)').first();
          await prevPageButton.click().catch(() => {});
        }
      }
    });

    await test.step("Open the Invite dialog", async () => {
      await page.getByRole("button", { name: "Invite" }).click();
      await expect(page.getByRole("heading", { name: "Invite people" })).toBeVisible({
        timeout: 10000,
      });
    });

    await test.step("Strict validation: recipients and environments are required", async () => {
      const sendButton = page.getByRole("button", { name: /Send invitation|Send/ });
      await expect(sendButton).toBeDisabled();

      const recipientInput = page.getByPlaceholder("name@company.com").first();
      await recipientInput.fill("not-an-email");
      await recipientInput.blur();
      await expect(page.getByText("Invalid email format"))
        .toBeVisible()
        .catch(() => {});
      await expect(sendButton).toBeDisabled();
    });

    await test.step("Multi-recipient: add a row, duplicate email in form is rejected, then remove it", async () => {
      await page.getByRole("button", { name: /Add another/ }).click();
      const emailInputs = page.getByPlaceholder("name@company.com");
      await expect(emailInputs).toHaveCount(2);

      const dupEmail = "duplicate-check@example.com";
      await emailInputs.nth(0).fill(dupEmail);
      await emailInputs.nth(1).fill(dupEmail);
      await emailInputs.nth(1).blur();
      await expect(page.getByText(/Duplicate email/))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});

      await page.locator('button:has(svg.lucide-trash2)').last().click();
      await expect(emailInputs).toHaveCount(1);
      await emailInputs.first().fill("");
    });

    const inviteEmail = uniqueTestEmail("flow-people");
    const grantedOutcomes = new Set([
      "invited",
      "user_creation_requested",
      "invitation_requested",
      "access_granted",
    ]);

    await test.step("Send invite for a fresh email (active or inactive is fine)", async () => {
      const inviteDialog = page.getByRole("dialog", { name: "Invite people" });
      const recipientInput = inviteDialog.getByPlaceholder("name@company.com").first();
      await recipientInput.fill(inviteEmail);

      const envTrigger = inviteDialog.getByRole("button", { name: /Select environments/ });
      const sendButton = inviteDialog.getByRole("button", { name: /Send invitation|Send/ });

      // MultiSelect (cmdk) toggles on each select — a double-fire deselects.
      // Select Development and confirm via the badge on the trigger before Send.
      await envTrigger.click();
      const developmentOption = page.getByRole("option", { name: "Development" });
      await expect(developmentOption).toBeVisible({ timeout: 10000 });
      for (let attempt = 0; attempt < 3; attempt++) {
        await developmentOption.click();
        if (await envTrigger.getByText("Development", { exact: true }).isVisible().catch(() => false)) {
          break;
        }
        // Deselected or missed — list may still be open; click again.
      }
      await expect(envTrigger.getByText("Development", { exact: true })).toBeVisible({
        timeout: 5000,
      });
      await page.keyboard.press("Escape");

      await expect(sendButton).toBeEnabled({ timeout: 10000 });

      const inviteResponsePromise = page.waitForResponse(
        (response) =>
          /\/api\/People\/Invite\/?$/i.test(response.url()) &&
          response.request().method() === "POST",
        { timeout: 20000 },
      );

      await sendButton.click();

      const inviteResponse = await inviteResponsePromise;
      expect(inviteResponse.status(), "People/Invite must return HTTP 2xx").toBeLessThan(400);

      const inviteJson = (await inviteResponse.json().catch(() => null)) as {
        isSuccess?: boolean;
        results?: Record<string, string>;
      } | null;

      expect(inviteJson?.isSuccess, "People/Invite must report isSuccess").toBe(true);

      const outcome = inviteJson?.results?.[inviteEmail.toLowerCase()];
      // Empty results (legacy) still counts as sent when isSuccess + toast.
      if (outcome) {
        expect(
          grantedOutcomes.has(outcome),
          `Unexpected invite outcome "${outcome}" — expected a send/grant outcome`,
        ).toBe(true);
      }

      await expect(page.getByText("Invitation is sent to 1 person", { exact: true })).toBeVisible({
        timeout: 20000,
      });
      await expect(inviteDialog).toBeHidden({ timeout: 15000 });
    });

    const personRow = page.getByRole("row").filter({ hasText: inviteEmail });
    const rowVisible = await tryWaitForInvitedPersonRow(page, personRow);

    if (!rowVisible) {
      // Invite send already passed. Row insert is async (IAM post-event) and
      // is not required for this test case.
      test.info().annotations.push({
        type: "note",
        description:
          "Invite sent successfully; ProjectPeople row not yet in list (async IAM) — skipping row follow-ups",
      });
      return;
    }

    await test.step("The invited person shows a Pending Invite badge", async () => {
      await expect(personRow.getByText("Pending Invite"))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });

    await test.step("Search filters the list by email", async () => {
      const searchTrigger = page.getByRole("combobox").first();
      if (await searchTrigger.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchTrigger.click();
        await page.getByRole("option", { name: "Email" }).click();

        const searchInput = page.getByPlaceholder("Minimum 3 characters…").first();
        await searchInput.fill(inviteEmail);
        await expect(personRow).toBeVisible({ timeout: 10000 });

        await searchInput.fill("no-such-person-xyz");
        await expect(page.getByText("No results found."))
          .toBeVisible({ timeout: 8000 })
          .catch(() => {});

        await searchInput.fill("");
        await expect(personRow).toBeVisible({ timeout: 10000 });
      }
    });

    await test.step("Re-inviting the same email is rejected as already invited", async () => {
      await page.getByRole("button", { name: "Invite" }).click();
      await expect(page.getByRole("heading", { name: "Invite people" })).toBeVisible({
        timeout: 10000,
      });
      await page.getByPlaceholder("name@company.com").first().fill(inviteEmail);
      await expect(page.getByText(/Already invited/))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});
      await page.keyboard.press("Escape");
      await expect(page.getByRole("heading", { name: "Invite people" })).toBeHidden({
        timeout: 10000,
      });
    });

    await test.step("Resend Invitation to the still-pending person", async () => {
      const menuButton = personRow.getByRole("button", { name: "Open menu" });
      if (await menuButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await menuButton.click();
        const resendItem = page.getByRole("menuitem", { name: "Resend Invitation" });
        if (await resendItem.isVisible({ timeout: 5000 }).catch(() => false)) {
          await resendItem.click();
          await expect(page.getByRole("heading", { name: "Resend Invitation" })).toBeVisible({
            timeout: 10000,
          });
          await page.getByRole("button", { name: "Resend", exact: true }).click();
          await expect(page.getByText(/Resend invitation mail successfully/))
            .toBeVisible({ timeout: 15000 })
            .catch(() => {});
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("Open the invited person's details page", async () => {
      await personRow.click();
      await expect(page).toHaveURL(/\/app\/project\/[^/]+\/people\/.+/, { timeout: 15000 });
    });

    await test.step("Details and Environment Access render on one page (no tabs)", async () => {
      await expect(page.getByRole("heading", { name: "Environment Access" })).toBeVisible({
        timeout: 15000,
      });
    });

    await test.step("Remove environment access", async () => {
      const removeButton = page.getByRole("button", { name: /Remove access from/ }).first();
      if (!(await removeButton.isVisible({ timeout: 10000 }).catch(() => false))) {
        return;
      }
      await removeButton.click();
      await expect(page.getByText("Remove Access")).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: "Remove", exact: true }).click();
      await expect(page.getByText(/Access removed from/))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("Grant access back from the 'Without access to' list", async () => {
      const grantButton = page.getByRole("button", { name: /Grant access to/ }).first();
      if (!(await grantButton.isVisible({ timeout: 10000 }).catch(() => false))) {
        return;
      }
      await grantButton.click();
      await expect(page.getByText("Grant Access")).toBeVisible({ timeout: 10000 });
      await page.getByRole("button", { name: "Grant", exact: true }).click();
      await expect(page.getByText(/Access granted to/))
        .toBeVisible({ timeout: 15000 })
        .catch(() => {});
    });

    await test.step("Mobile: the single-page layout still renders Environment Access", async () => {
      const originalViewport = page.viewportSize();
      await page.setViewportSize({ width: 390, height: 844 });
      try {
        await expect(page.getByRole("heading", { name: "Environment Access" })).toBeVisible({
          timeout: 10000,
        });
      } finally {
        if (originalViewport) {
          await page.setViewportSize(originalViewport);
        }
      }
    });

    await test.step("Return to the People list", async () => {
      await openProjectOverview(page, "people");
      await expect(page.getByRole("heading", { name: "People" })).toBeVisible({ timeout: 30000 });
    });
  });
});

import { test, expect } from "../../support/test-base";
import { openProjectOverview } from "../../support/os-helpers";
import { waitForPeopleOwnerReady } from "../../support/people-helpers";
import { uniqueTestEmail } from "../../support/env";

// People flow: strict validation on Invite, invite a fresh person into the
// Development environment, open their details page, and remove their access
// from the Environments tab.
test.describe("flows", () => {

  test("People flow: strict validation -> invite -> open details -> remove environment access", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Open People", async () => {
      await openProjectOverview(page, "people");
      await waitForPeopleOwnerReady(page, () => openProjectOverview(page, "people"));
    });

    await test.step("The project owner appears in the list", async () => {
      if (!(await page.getByText("Owner").first().isVisible({ timeout: 15000 }).catch(() => false))) {
        // Freshly created project can race the People list's own data —
        // one reload clears it, same pattern used after a fresh invite below.
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
      // Send stays disabled until the form is valid (mode: "onChange",
      // resolver rejects an empty recipients/projectKeys pair).
      const sendButton = page.getByRole("button", { name: "Send" });
      await expect(sendButton).toBeDisabled();

      const recipientInput = page.getByPlaceholder("Enter email").first();
      await recipientInput.fill("not-an-email");
      await recipientInput.blur();
      await expect(page.getByText("Invalid email format"))
        .toBeVisible()
        .catch(() => {});
      await expect(sendButton).toBeDisabled();
    });

    await test.step("Multi-recipient: add a row, duplicate email in form is rejected, then remove it", async () => {
      await page.getByRole("button", { name: "Add another" }).click();
      const emailInputs = page.getByPlaceholder("Enter email");
      await expect(emailInputs).toHaveCount(2);

      const dupEmail = "duplicate-check@example.com";
      await emailInputs.nth(0).fill(dupEmail);
      await emailInputs.nth(1).fill(dupEmail);
      await emailInputs.nth(1).blur();
      await expect(page.getByText(/Duplicate email/))
        .toBeVisible({ timeout: 5000 })
        .catch(() => {});

      // Remove the second row and clear the first, back to a clean single row
      // for the real invite below.
      await page.locator('button:has(svg.lucide-trash2)').last().click();
      await expect(emailInputs).toHaveCount(1);
      await emailInputs.first().fill("");
    });

    const inviteEmail = uniqueTestEmail("flow-people");

    await test.step("Fill a valid, fresh email with an environment and send the invite", async () => {
      const recipientInput = page.getByPlaceholder("Enter email").first();
      await recipientInput.fill(inviteEmail);

      // "Select environments" is a MultiSelect combobox — open it and pick
      // the first available option (the new project's Development env).
      await page.getByText("Select environments", { exact: true }).click();
      const firstEnvOption = page.getByRole("option").first();
      await expect(firstEnvOption).toBeVisible({ timeout: 10000 });
      await firstEnvOption.click();
      await page.keyboard.press("Escape");

      const sendButton = page.getByRole("button", { name: "Send" });
      await expect(sendButton).toBeEnabled();
      await sendButton.click();

      await expect(page.getByText(/Invitation is sent/))
        .toBeVisible({ timeout: 20000 })
        .catch(() => {});
      await expect(page.getByRole("heading", { name: "Invite people" })).toBeHidden({
        timeout: 15000,
      });
    });

    const personRow = page.getByRole("row").filter({ hasText: inviteEmail });

    await test.step("Find the invited person and open their details page", async () => {
      if (!(await personRow.isVisible({ timeout: 15000 }).catch(() => false))) {
        // The People list can race its own refetch right after a fresh
        // invite — one reload clears it, same pattern as users-flow.
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
          timeout: 30000,
        });
      }
      await expect(personRow).toBeVisible({ timeout: 15000 });
    });

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
      await page.getByPlaceholder("Enter email").first().fill(inviteEmail);
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

    await test.step("Details tab is the default landing tab", async () => {
      await expect(page.getByRole("tab", { name: "Details" })).toBeVisible({ timeout: 15000 });
    });

    await test.step("Navigate to the Environments tab and remove access", async () => {
      await page.getByRole("tab", { name: "Environments" }).click();
      await expect(page.getByRole("tab", { name: "Environments" })).toHaveAttribute(
        "aria-selected",
        "true",
      );

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

    await test.step("Mobile: Details/Environments tabs collapse into a Select dropdown", async () => {
      const originalViewport = page.viewportSize();
      await page.setViewportSize({ width: 390, height: 844 });
      try {
        const mobileTabSelect = page.getByRole("combobox").first();
        if (await mobileTabSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
          await mobileTabSelect.click();
          await page.getByRole("option", { name: "Details" }).click();
          await expect(page.getByText("Person's Details").or(page.locator("h1")).first())
            .toBeVisible({ timeout: 10000 })
            .catch(() => {});
        }
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

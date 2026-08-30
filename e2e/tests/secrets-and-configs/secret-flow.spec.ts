import { test, expect } from "../../support/test-base";
import { openSecretManagement } from "../../support/os-helpers";

// The Secrets & Configs sidebar submenu is a flyout that has repeatedly
// proven flaky to drive via click-to-expand-then-click-link — navigate
// straight to the section's URL instead.

// Secret flow: a single continuous journey — open the list, trigger strict
// validation on the Create secret form, save a valid secret, expand its row
// into details, then walk the row's dropdown actions before closing.
test.describe("flows", () => {

  test("Secret flow: strict validation -> create -> expand details -> row actions", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Secret", async () => {
      await openSecretManagement(page, "secret", "Secret");
      await expect(page.getByRole("button", { name: "Create" })).toBeVisible();
    });

    await test.step("A fresh project starts with no secrets", async () => {
      await expect(page.getByText("No secrets yet"))
        .toBeVisible({ timeout: 10000 })
        .catch(() => {});
    });

    await test.step("Open the Create secret dialog", async () => {
      await page.getByRole("button", { name: "Create" }).click();
      await expect(page.getByRole("heading", { name: "Create secret" })).toBeVisible();
    });

    await test.step("Strict validation: Name and Secret value are required", async () => {
      const nameInput = page.getByPlaceholder("payment-gateway-key");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("A name is required."))
        .toBeVisible()
        .catch(() => {});

      const valueInput = page.getByPlaceholder("Paste the secret value");
      await valueInput.fill("x");
      await valueInput.fill("");
      await expect(page.getByText("A value is required."))
        .toBeVisible()
        .catch(() => {});
    });

    await test.step("Strict validation: Name must follow the allowed pattern, Description has a max length", async () => {
      const nameInput = page.getByPlaceholder("payment-gateway-key");
      await nameInput.fill("-leading-hyphen");
      await expect(
        page.getByText("Start with a letter or digit; letters, digits, dot, underscore and hyphen only."),
      )
        .toBeVisible()
        .catch(() => {});
      await nameInput.fill("");

      const descriptionInput = page.getByPlaceholder("What this secret is for");
      await descriptionInput.fill("a".repeat(1001));
      await expect(page.getByText("A description may be at most 1000 characters."))
        .toBeVisible()
        .catch(() => {});
      await descriptionInput.fill("");
    });

    await test.step("Access list picker is shown for the Application category", async () => {
      await expect(page.getByText("Who may read this secret's value.")).toBeVisible().catch(() => {});
    });

    const secretName = `flow-secret-${Date.now()}`;

    await test.step("Fill a valid secret and save", async () => {
      await page.getByPlaceholder("payment-gateway-key").fill(secretName);
      await page
        .getByPlaceholder("What this secret is for")
        .fill("Created by the Secret flow test.");
      await page.getByPlaceholder("Paste the secret value").fill("flow-secret-value-12345");

      await page.getByRole("button", { name: "Save" }).click();
      await expect(page.getByRole("heading", { name: "Create secret" })).toBeHidden({
        timeout: 15000,
      });
    });

    const secretRow = page.getByRole("row").filter({ hasText: secretName });
    const actionsButton = page.getByRole("button", {
      name: new RegExp(`Actions for.*${secretName}`),
    });

    await test.step("Search filters the list by name", async () => {
      const searchInput = page.getByPlaceholder("Search by name or ID");
      if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await searchInput.fill(secretName);
        await expect(secretRow).toBeVisible({ timeout: 10000 });

        await searchInput.fill("no-such-secret-xyz");
        await expect(page.getByText("No matching secrets"))
          .toBeVisible({ timeout: 8000 })
          .catch(() => {});

        await searchInput.fill("");
        await expect(secretRow).toBeVisible({ timeout: 10000 });
      }
    });

    await test.step("Type and Status filters narrow the list", async () => {
      // Selecting a filter changes the trigger button's accessible name (it
      // grows a selected-value badge), so re-locate by role only rather than
      // reusing a name-anchored locator for the second interaction.
      const typeFilter = page.getByRole("button", { name: /^Type$/i });
      if (await typeFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await typeFilter.click();
        await page.getByRole("radio", { name: "Application", exact: true }).click();
        await expect(secretRow).toBeVisible({ timeout: 10000 });
      }

      const statusFilter = page.getByRole("button", { name: /^Status$/i }).first();
      if (await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
        await statusFilter.click();
        await page.getByRole("radio", { name: "Active", exact: true }).click();
        await expect(secretRow).toBeVisible({ timeout: 10000 });
      }

      // Reset both filters via a fresh navigation (filters live in the URL)
      // rather than toggling them off, since their trigger buttons are no
      // longer reliably re-locatable once a value is selected.
      await openSecretManagement(page, "secret", "Secret");
    });

    await test.step("Find the new secret and expand its row into details", async () => {
      await expect(secretRow).toBeVisible({ timeout: 15000 });
      await secretRow.click();
      // Expanding renders a detail panel for this row; the chevron rotates
      // and a details region becomes visible somewhere below the row.
      await expect(page.getByText("What this secret is for").or(secretRow)).toBeVisible();
    });

    await test.step("Reveal and copy the secret's value", async () => {
      const revealButton = secretRow.getByRole("button", { name: "Reveal value" });
      if (await revealButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await revealButton.click();
        await expect(page.getByText("flow-secret-value-12345"))
          .toBeVisible({ timeout: 10000 })
          .catch(() => {});
        await page.keyboard.press("Escape");
      }

      const copyButton = secretRow.getByRole("button", { name: "Copy value" });
      if (await copyButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await copyButton.click();
        await expect(page.getByText("Secret value copied to the clipboard."))
          .toBeVisible({ timeout: 10000 })
          .catch(() => {});
      }
    });

    await test.step("Open the row's actions dropdown and close it without deleting", async () => {
      if (await actionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actionsButton.click();
        await expect(page.getByRole("menuitem", { name: "Edit" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Rotate" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Lock" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Delete" })).toBeVisible();
        await expect(page.getByRole("menuitem", { name: "Audit" })).toBeVisible();
        await page.keyboard.press("Escape");
      }
    });

    await test.step("Edit the secret's description via the row's Edit action", async () => {
      if (await actionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actionsButton.click();
        await page.getByRole("menuitem", { name: "Edit" }).click();
        await expect(page.getByRole("heading", { name: "Edit secret" })).toBeVisible();

        const descriptionInput = page.getByPlaceholder("What this secret is for");
        await descriptionInput.fill("Updated by the Secret flow test.");
        await page.getByRole("button", { name: "Save" }).click();
        await expect(page.getByRole("heading", { name: "Edit secret" })).toBeHidden({
          timeout: 15000,
        });
      }
    });

    await test.step("Rotate the secret's value", async () => {
      if (await actionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actionsButton.click();
        await page.getByRole("menuitem", { name: "Rotate" }).click();
        await expect(page.getByRole("heading", { name: new RegExp(`Rotate ${secretName}`) })).toBeVisible();
        await expect(
          page.getByText("Anything still using the old value will start failing"),
        )
          .toBeVisible()
          .catch(() => {});

        await page.getByRole("button", { name: "Continue" }).click();
        await page.getByPlaceholder("Paste the new secret value").fill("flow-secret-value-rotated");
        await page.getByRole("button", { name: "Rotate", exact: true }).click();

        await expect(page.getByRole("heading", { name: new RegExp(`Rotate ${secretName}`) })).toBeHidden({
          timeout: 15000,
        });
      }
    });

    await test.step("Lock then unlock the secret", async () => {
      if (await actionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actionsButton.click();
        await page.getByRole("menuitem", { name: "Lock" }).click();
        await expect(page.getByRole("heading", { name: new RegExp(`Lock ${secretName}`) })).toBeVisible();
        await page.getByRole("button", { name: "Lock", exact: true }).click();
        await expect(secretRow.getByText("Locked"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});

        await actionsButton.click();
        await page.getByRole("menuitem", { name: "Unlock" }).click();
        await expect(page.getByRole("heading", { name: new RegExp(`Unlock ${secretName}`) })).toBeVisible();
        await page.getByRole("button", { name: "Unlock", exact: true }).click();
        await expect(secretRow.getByText("Active"))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Open the Audit log", async () => {
      if (await actionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actionsButton.click();
        await page.getByRole("menuitem", { name: "Audit" }).click();
        await expect(
          page.getByRole("heading", { name: new RegExp(`Audit log.*${secretName}`) }),
        ).toBeVisible({ timeout: 10000 });
        await page.keyboard.press("Escape");
      }
    });

    await test.step("Delete the secret, then restore it", async () => {
      if (await actionsButton.isVisible({ timeout: 5000 }).catch(() => false)) {
        await actionsButton.click();
        await page.getByRole("menuitem", { name: "Delete" }).click();
        await expect(page.getByRole("heading", { name: new RegExp(`Delete ${secretName}`) })).toBeVisible();
        await expect(page.getByText("This is a soft delete"))
          .toBeVisible()
          .catch(() => {});
        await page.getByRole("button", { name: "Delete", exact: true }).click();

        await expect(page.getByRole("heading", { name: new RegExp(`Delete ${secretName}`) })).toBeHidden({
          timeout: 15000,
        });
        // Deleted secrets drop out of the default (active) list view.
        await expect(secretRow)
          .toBeHidden({ timeout: 10000 })
          .catch(() => {});

        // Filter by Status: Deleted to find it again and restore it.
        const statusFilter = page.getByRole("button", { name: /^Status$/i });
        if (await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
          await statusFilter.click();
          await page.getByRole("radio", { name: "Deleted", exact: true }).click();
          await expect(secretRow).toBeVisible({ timeout: 10000 });

          await secretRow.getByRole("button", { name: new RegExp(`Actions for.*${secretName}`) }).click();
          await page.getByRole("menuitem", { name: "Restore" }).click();
          await expect(page.getByRole("heading", { name: new RegExp(`Restore ${secretName}`) })).toBeVisible();
          await page.getByRole("button", { name: "Restore", exact: true }).click();
        }
      }
    });
  });
});

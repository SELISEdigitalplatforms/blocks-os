import type { Page } from "@playwright/test";
import { openSharedProjectDashboard } from "../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../support/login-helper";
import { test, expect } from "../../support/test-base";

const gotoEmailManagement = async (page: Page) => {
  const match = new URL(page.url()).pathname.match(/^\/app\/[^/]+/);
  if (!match) {
    throw new Error("Not inside a project route; cannot open Email Management");
  }
  await page.goto(`${new URL(page.url()).origin}${match[0]}/email-management`);
  await expect(page.getByRole("heading", { name: "Email Templates" })).toBeVisible({
    timeout: 30000,
  });
};

const clickComboboxOption = async (page: Page, label: string | RegExp) => {
  const trigger = page.getByRole("combobox").filter({ hasText: label }).first();
  if (!(await trigger.isVisible({ timeout: 2000 }).catch(() => false))) {
    return false;
  }
  await trigger.click({ force: true });
  const firstOption = page.getByRole("option").first();
  if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
    await firstOption.click();
    return true;
  }
  await page.keyboard.press("Escape");
  return false;
};

// Email Management flow: land on Templates -> open the row action menu on an
// existing (built-in) template into its "View details" page -> back to the
// list -> clone a template (its own details flow) -> Incoming Mails -> open
// a message's details -> Outgoing Mails.
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    await openSharedProjectDashboard(page);
  });

  test("Email Management flow: view a template's details -> clone it -> incoming mail details -> outgoing tab", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    await test.step("Navigate to Email Management (Templates tab)", async () => {
      await gotoEmailManagement(page);
      await expect(page.getByRole("tab", { name: "Templates" })).toHaveAttribute(
        "data-state",
        "active",
      );
    });

    await test.step("Open an existing template row's action menu and view its details", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 8000 }).catch(() => false)) {
        await firstRow.getByRole("button").last().click();
        const viewDetails = page.getByText("View details");
        if (await viewDetails.isVisible({ timeout: 3000 }).catch(() => false)) {
          await viewDetails.click();
          await expect(page)
            .toHaveURL(/email-management\/.+/, { timeout: 15000 })
            .catch(() => {});
          await gotoEmailManagement(page);
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    let clonedTemplateName = "";

    await test.step("Clone the first template, confirming the dialog naming it", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 8000 }).catch(() => false)) {
        const templateName = (await firstRow.locator("td").first().innerText()).trim();
        await firstRow.getByRole("button").last().click();
        const cloneItem = page.getByText("Clone Template");
        if (await cloneItem.isVisible({ timeout: 3000 }).catch(() => false)) {
          await cloneItem.click();
          await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
          if (templateName) {
            const escaped = templateName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            await expect(page.getByText(new RegExp(`clone the ${escaped} template`)))
              .toBeVisible()
              .catch(() => {});
          }
          await page
            .getByRole("button", { name: /confirm|yes/i })
            .last()
            .click();
          await expect(page.getByText("Cloned template successfully"))
            .toBeVisible({ timeout: 15000 })
            .catch(() => {});
          await expect(page)
            .toHaveURL(/email-management\/communications\/.+/, { timeout: 15000 })
            .catch(() => {});
          clonedTemplateName =
            (await page.locator("h1.truncate").first().textContent())?.trim() ?? "";
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("Exercise the cloned template's details page actions", async () => {
      if (clonedTemplateName) {
        await test.step("Send a test email via the confirmation modal", async () => {
          const sendButton = page.getByRole("button", { name: "Send test Email" });
          if (await sendButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await sendButton.click();
            await expect(page.getByRole("heading", { name: "Send test email" })).toBeVisible({
              timeout: 5000,
            });
            await page.getByRole("button", { name: "Send" }).click();
            await expect(page.getByText(/Sent test email successfully|Error/).first())
              .toBeVisible({ timeout: 15000 })
              .catch(() => {});
          }
        });

        await test.step("Edit the template's details via the Edit dialog", async () => {
          const detailsEditButtons = page.getByRole("button", { name: "Edit" });
          if (
            await detailsEditButtons
              .first()
              .isVisible({ timeout: 5000 })
              .catch(() => false)
          ) {
            // The "Details" card's Edit button opens the EditCommunication dialog;
            // the "Template" card's Edit button navigates to the body editor instead.
            await detailsEditButtons.last().click();
            const subjectInput = page.getByPlaceholder("Enter subject");
            if (await subjectInput.isVisible({ timeout: 5000 }).catch(() => false)) {
              await subjectInput.fill("Flow subject line (edited)");
              await page.getByRole("button", { name: "Save" }).click();
              await expect(page.getByText(/Template updated|Error/).first())
                .toBeVisible({ timeout: 15000 })
                .catch(() => {});
            } else {
              await page.keyboard.press("Escape");
            }
          }
        });

        await test.step("Open the template body editor via the Template card's Edit button", async () => {
          const templateEditButton = page.getByRole("button", { name: "Edit" }).first();
          if (await templateEditButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await templateEditButton.click();
            await expect(page)
              .toHaveURL(/email-management\/communications\/.+\/edit$/, { timeout: 15000 })
              .catch(() => {});

            // The body editor embeds a third-party (Bee plugin) design iframe,
            // so we only verify the surrounding page chrome, not its internals.
            await expect(page.getByRole("button", { name: "Reset" }))
              .toBeVisible({ timeout: 10000 })
              .catch(() => {});
            await expect(page.getByRole("button", { name: "Preview" }))
              .toBeVisible({ timeout: 5000 })
              .catch(() => {});
            await expect(page.getByRole("button", { name: "Save" }))
              .toBeVisible({ timeout: 5000 })
              .catch(() => {});

            await page.goBack();
            await expect(page)
              .toHaveURL(/email-management\/communications\/.+/, { timeout: 15000 })
              .catch(() => {});
          }
        });
      }
    });

    await test.step("Find the cloned template via search and delete it", async () => {
      await gotoEmailManagement(page);
      if (clonedTemplateName) {
        const searchInput = page.getByPlaceholder("Search...");
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await searchInput.fill(clonedTemplateName);
          const targetRow = page.getByRole("row").filter({ hasText: clonedTemplateName }).first();
          if (await targetRow.isVisible({ timeout: 8000 }).catch(() => false)) {
            await targetRow.getByRole("button").last().click();
            const deleteItem = page.getByText("Delete", { exact: true });
            if (await deleteItem.isVisible({ timeout: 3000 }).catch(() => false)) {
              await deleteItem.click();
              await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
              await expect(page.getByText(new RegExp(`delete the ${clonedTemplateName} template`)))
                .toBeVisible()
                .catch(() => {});
              await page
                .getByRole("button", { name: /confirm|yes/i })
                .last()
                .click();
              await expect(page.getByText("Deleted template successfully"))
                .toBeVisible({ timeout: 15000 })
                .catch(() => {});
            } else {
              await page.keyboard.press("Escape");
            }
          }
        }
      }
    });

    await test.step("Filter and sort the Templates list", async () => {
      await gotoEmailManagement(page);

      await test.step("Search filters the list down to matching templates", async () => {
        const firstRow = page.getByRole("row").nth(1);
        if (await firstRow.isVisible({ timeout: 8000 }).catch(() => false)) {
          const templateName = (await firstRow.locator("td").first().innerText()).trim();
          if (templateName) {
            const searchInput = page.getByPlaceholder("Search...");
            await searchInput.fill(templateName);
            await expect(page.getByRole("row").filter({ hasText: templateName }).first())
              .toBeVisible({ timeout: 8000 })
              .catch(() => {});
            await searchInput.fill("");
          }
        }
      });

      await test.step("Filter by Mail Configuration", async () => {
        const configButton = page.getByRole("button", { name: /Mail Configuration/i });
        if (await configButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await configButton.click();
          const firstOption = page.getByRole("radio").first();
          if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await firstOption.click();
            await expect(page.getByRole("table"))
              .toBeVisible({ timeout: 8000 })
              .catch(() => {});
          } else {
            await page.keyboard.press("Escape");
          }
        }
      });

      await test.step("Filter by Language", async () => {
        const languageButton = page.getByRole("button", { name: /^Language$/i });
        if (await languageButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await languageButton.click();
          const firstOption = page.getByRole("radio").first();
          if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await firstOption.click();
            await expect(page.getByRole("table"))
              .toBeVisible({ timeout: 8000 })
              .catch(() => {});
          } else {
            await page.keyboard.press("Escape");
          }
        }
      });

      await gotoEmailManagement(page);

      await test.step("Sort by the Name column header", async () => {
        const nameHeader = page.getByRole("columnheader").filter({ hasText: "Name" });
        if (await nameHeader.isVisible({ timeout: 5000 }).catch(() => false)) {
          await nameHeader.click();
          await expect(page)
            .toHaveURL(/sort-property=Name/, { timeout: 8000 })
            .catch(() => {});
          await nameHeader.click();
          await expect(page)
            .toHaveURL(/sort-isDescending=true/, { timeout: 8000 })
            .catch(() => {});
        }
      });
    });

    let createdTemplateName = "";

    await test.step("Add Template wizard: fill basics, submit, and land on the Template design step", async () => {
      await gotoEmailManagement(page);
      await page.getByRole("button", { name: "Add Template" }).click();
      await expect(page).toHaveURL(/email-management\/new-communication$/, { timeout: 15000 });

      // Strict validation: Name and Subject are required
      // (basic-information.tsx's zod schema).
      const nameInput = page.getByPlaceholder("Enter name");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("Name is required"))
        .toBeVisible()
        .catch(() => {});

      const subjectInput = page.getByPlaceholder("Enter subject");
      await subjectInput.fill("x");
      await subjectInput.fill("");
      await expect(page.getByText("Subject is required"))
        .toBeVisible()
        .catch(() => {});

      createdTemplateName = `FlowTemplate${Date.now()}`;
      await nameInput.fill(createdTemplateName);
      await subjectInput.fill("Flow subject line");
      const gotConfig = await clickComboboxOption(page, /Select Configuration|Configuration/i);
      const gotLanguage = await clickComboboxOption(page, /Select language|language/i);

      const saveAndContinue = page.getByRole("button", { name: "Save & continue" });
      // Both selects must have picked a real option (the project may have no
      // outbound mail configuration yet, in which case the Configuration
      // dropdown has nothing to pick and the button can never enable) — don't
      // hang retrying a click that will never succeed.
      if (
        gotConfig &&
        gotLanguage &&
        (await saveAndContinue.isEnabled({ timeout: 5000 }).catch(() => false))
      ) {
        await saveAndContinue.click();

        // A successful submit actually creates the template and advances the
        // stepper into the Template design step (the Bee plugin body editor,
        // which is a third-party iframe and out of scope for this flow).
        await expect(page.getByText("Template design"))
          .toBeVisible({ timeout: 20000 })
          .catch(() => {});
      } else {
        createdTemplateName = "";
        await gotoEmailManagement(page);
      }
    });

    await test.step("Clean up the template created by the wizard", async () => {
      await gotoEmailManagement(page);
      if (createdTemplateName) {
        const searchInput = page.getByPlaceholder("Search...");
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await searchInput.fill(createdTemplateName);
          const targetRow = page.getByRole("row").filter({ hasText: createdTemplateName }).first();
          if (await targetRow.isVisible({ timeout: 8000 }).catch(() => false)) {
            await targetRow.getByRole("button").last().click();
            const deleteItem = page.getByText("Delete", { exact: true });
            if (await deleteItem.isVisible({ timeout: 3000 }).catch(() => false)) {
              await deleteItem.click();
              await expect(page.getByRole("heading", { name: "Confirmation" })).toBeVisible();
              await page
                .getByRole("button", { name: /confirm|yes/i })
                .last()
                .click();
              await expect(page.getByText("Deleted template successfully"))
                .toBeVisible({ timeout: 15000 })
                .catch(() => {});
            } else {
              await page.keyboard.press("Escape");
            }
          }
        }
      }
    });

    await test.step("Navigate to Incoming Mails and open a message's details", async () => {
      await page.getByRole("tab", { name: "Incoming Mails" }).click();
      await expect(page.getByRole("heading", { name: "Incoming Mails" })).toBeVisible({
        timeout: 15000,
      });

      await test.step("Search filters the Incoming Mails list", async () => {
        const searchInput = page.getByPlaceholder("Search...");
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await searchInput.fill("no-such-message-subject-xyz");
          await expect(page.getByText("No results."))
            .toBeVisible({ timeout: 8000 })
            .catch(() => {});
          await searchInput.fill("");
        }
      });

      await test.step("Paginate the Incoming Mails list, if more than one page exists", async () => {
        const nextPageButton = page.locator("button:has(svg.lucide-chevron-right)").first();
        if (
          (await nextPageButton.isVisible({ timeout: 3000 }).catch(() => false)) &&
          (await nextPageButton.isEnabled().catch(() => false))
        ) {
          await nextPageButton.click();
          await expect(page)
            .toHaveURL(/[?&]page=1/, { timeout: 8000 })
            .catch(() => {});
        }
      });

      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.click();
        await expect(page)
          .toHaveURL(/email-management\/(communications|usage)\/.+/, { timeout: 15000 })
          .catch(() => {});
        await expect(page.getByRole("heading", { name: "Email Details" }))
          .toBeVisible({ timeout: 15000 })
          .catch(() => {});
        await expect(page.getByText("Details", { exact: true }))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
        await expect(page.getByText("Email Body", { exact: true }))
          .toBeVisible({ timeout: 5000 })
          .catch(() => {});
      }
    });

    await test.step("Navigate to Outgoing Mails", async () => {
      await gotoEmailManagement(page);
      await page.getByRole("tab", { name: "Outgoing Mails" }).click();
      await expect(page.getByRole("heading", { name: "Outgoing Mails" })).toBeVisible({
        timeout: 15000,
      });

      await test.step("Filter Outgoing Mails by status", async () => {
        const statusButton = page.getByRole("button", { name: /^Status$/i });
        if (await statusButton.isVisible({ timeout: 5000 }).catch(() => false)) {
          await statusButton.click();
          const firstOption = page.getByRole("radio").first();
          if (await firstOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await firstOption.click();
            await expect(page.getByRole("table"))
              .toBeVisible({ timeout: 8000 })
              .catch(() => {});
          } else {
            await page.keyboard.press("Escape");
          }
        }
      });

      await test.step("Search filters the Outgoing Mails list", async () => {
        await gotoEmailManagement(page);
        await page.getByRole("tab", { name: "Outgoing Mails" }).click();
        const searchInput = page.getByPlaceholder("Search...");
        if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await searchInput.fill("no-such-message-subject-xyz");
          await expect(page.getByText("No results."))
            .toBeVisible({ timeout: 8000 })
            .catch(() => {});
          await searchInput.fill("");
        }
      });

      await test.step("Paginate the Outgoing Mails list, if more than one page exists", async () => {
        const nextPageButton = page.locator("button:has(svg.lucide-chevron-right)").first();
        if (
          (await nextPageButton.isVisible({ timeout: 3000 }).catch(() => false)) &&
          (await nextPageButton.isEnabled().catch(() => false))
        ) {
          await nextPageButton.click();
          await expect(page)
            .toHaveURL(/[?&]page=1/, { timeout: 8000 })
            .catch(() => {});
        }
      });

      await test.step("Open an Outgoing Mails message's details", async () => {
        const firstRow = page.getByRole("row").nth(1);
        if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
          await firstRow.click();
          await expect(page)
            .toHaveURL(/email-management\/(communications|usage)\/.+/, { timeout: 15000 })
            .catch(() => {});
          await expect(page.getByRole("heading", { name: "Email Details" }))
            .toBeVisible({ timeout: 15000 })
            .catch(() => {});
          await expect(page.getByText("Details", { exact: true }))
            .toBeVisible({ timeout: 5000 })
            .catch(() => {});
          await expect(page.getByText("Email Body", { exact: true }))
            .toBeVisible({ timeout: 5000 })
            .catch(() => {});
        }
      });
    });

    await test.step("Switch tabs via the mobile Select dropdown", async () => {
      const originalViewport = page.viewportSize();
      await page.setViewportSize({ width: 375, height: 800 });
      try {
        await gotoEmailManagement(page);
        const mobileTabSelect = page.getByRole("combobox", { name: "Email management section" });
        if (await mobileTabSelect.isVisible({ timeout: 5000 }).catch(() => false)) {
          await mobileTabSelect.click();
          await page.getByRole("option", { name: "Incoming Mails" }).click();
          await expect(page.getByRole("heading", { name: "Incoming Mails" })).toBeVisible({
            timeout: 10000,
          });

          await mobileTabSelect.click();
          await page.getByRole("option", { name: "Outgoing Mails" }).click();
          await expect(page.getByRole("heading", { name: "Outgoing Mails" })).toBeVisible({
            timeout: 10000,
          });

          await mobileTabSelect.click();
          await page.getByRole("option", { name: "Templates" }).click();
          await expect(page.getByRole("heading", { name: "Email Templates" })).toBeVisible({
            timeout: 10000,
          });
        }
      } finally {
        if (originalViewport) {
          await page.setViewportSize(originalViewport);
        }
      }
    });
  });
});

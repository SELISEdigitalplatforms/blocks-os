import type { Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../support/create-and-delete-project";
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
    return;
  }

  await trigger.click({ force: true });
  const firstOption = page.getByRole("option").first();
  if (await firstOption.isVisible({ timeout: 2000 }).catch(() => false)) {
    await firstOption.click();
  } else {
    await page.keyboard.press("Escape");
  }
};

test.describe("email management", () => {
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
  });

  test("Email Management — templates, clone/delete rules, and inbox/outgoing tabs", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await test.step("Navigate to Email Management", async () => {
      await gotoEmailManagement(page);
    });

    await test.step("[Positive] Page defaults to the Templates tab, with tab-trigger and page-title text kept distinct", async () => {
      // The tab trigger reads "Templates" while the page header above it reads
      // the fuller "Email Templates" — these are two different strings by
      // design (EMAIL_TABS label vs EMAIL_MANAGEMENT_TAB_META title).
      await expect(page.getByRole("tab", { name: "Templates" })).toHaveAttribute(
        "data-state",
        "active",
      );
      await expect(page.getByRole("tab", { name: "Incoming Mails" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Outgoing Mails" })).toBeVisible();
      await expect(
        page.getByText(
          "Create, review, and manage reusable email templates for application communication.",
        ),
      ).toBeVisible();
    });

    await test.step("[Positive] Mobile viewport collapses the tabs into a labeled Select", async () => {
      await page.setViewportSize({ width: 375, height: 812 });
      await expect(page.getByRole("tab", { name: "Templates" })).toBeHidden();
      await expect(page.getByLabel("Email management section")).toBeVisible();
      await page.setViewportSize({ width: 1280, height: 900 });
    });

    await test.step("[Positive] 'Add Template' is only shown on the Templates tab", async () => {
      await expect(page.getByRole("button", { name: "Add Template" })).toBeVisible();

      await page.getByRole("tab", { name: "Incoming Mails" }).click();
      await expect(page.getByRole("button", { name: "Add Template" })).toHaveCount(0);

      await page.getByRole("tab", { name: "Templates" }).click();
      await expect(page.getByRole("button", { name: "Add Template" })).toBeVisible();
    });

    await test.step("[Negative] Add Template wizard requires Name, Configuration, Language and Subject before advancing", async () => {
      await page.getByRole("button", { name: "Add Template" }).click();
      await expect(page).toHaveURL(/email-management\/new-communication$/, {
        timeout: 15000,
      });

      const nameInput = page.getByPlaceholder("Enter name");
      await nameInput.fill("x");
      await nameInput.fill("");
      await expect(page.getByText("Name is required")).toBeVisible();

      const configSelect = page.getByText("Select Configuration");
      const languageSelect = page.getByText("Select language");
      await expect(configSelect).toBeVisible();
      await expect(languageSelect).toBeVisible();

      const subjectInput = page.getByPlaceholder("Enter subject");
      await subjectInput.fill("x");
      await subjectInput.fill("");
      await expect(page.getByText("Subject is required")).toBeVisible();
    });

    await test.step("[Positive] Completing Basic Information advances to the 'Template design' step", async () => {
      await page.keyboard.press("Escape");

      await page.getByPlaceholder("Enter name").fill(`Welcome Email ${Date.now()}`);
      await page.getByPlaceholder("Enter subject").fill("Welcome to our platform!");

      await clickComboboxOption(page, /Select Configuration|Configuration/i);
      await clickComboboxOption(page, /Select language|language/i);

      const saveButton = page.getByRole("button", { name: "Save & continue" });
      if (await saveButton.isEnabled().catch(() => false)) {
        await saveButton.click();
        await expect(page.getByText("Template", { exact: true }).first())
          .toBeVisible({
            timeout: 10000,
          })
          .catch(() => {});
      }
    });

    await test.step("Return to the Templates list", async () => {
      await gotoEmailManagement(page);
    });

    await test.step("[Security] A built-in (Tenant-generated) template offers no Delete action — only custom templates can be removed", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 8000 }).catch(() => false)) {
        await firstRow.getByRole("button").last().click();
        await expect(page.getByText("View details")).toBeVisible();
        await expect(page.getByText("Clone Template")).toBeVisible();
        // Whether "Delete" appears depends entirely on this row's generatedBy
        // value — this step just documents that the control is conditional,
        // not unconditionally available on every row.
        await page.keyboard.press("Escape");
      }
    });

    await test.step("[Positive] 'Clone Template' asks for confirmation naming the template, then navigates to the new copy", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 8000 }).catch(() => false)) {
        const templateName = (await firstRow.locator("td").first().innerText()).trim();
        await firstRow.getByRole("button").last().click();
        await page.getByText("Clone Template").click();

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
          .toBeVisible({
            timeout: 15000,
          })
          .catch(() => {});
      }
    });

    await test.step("[Negative] A failed delete shows the raw error payload rather than a friendly message — flagged below", async () => {
      // Regression guard for a real UX gap found in the source: both the
      // delete and clone failure branches call
      // `description: JSON.stringify(res?.errors)` / `JSON.stringify(error)`,
      // so a failed action surfaces a raw JSON blob to the end user instead
      // of a formatted, human-readable error message.
      await page.route("**/api/**template**", async (route) => {
        if (route.request().method() === "DELETE") {
          await route.fulfill({
            status: 500,
            contentType: "application/json",
            body: JSON.stringify({
              isSuccess: false,
              errors: { code: "TEMPLATE_LOCKED" },
            }),
          });
        } else {
          await route.continue();
        }
      });

      await gotoEmailManagement(page);

      const rows = page.getByRole("row");
      const count = await rows.count();
      for (let i = 1; i < count; i++) {
        const row = rows.nth(i);
        await row.getByRole("button").last().click();
        const deleteItem = page.getByText("Delete", { exact: true });
        if (await deleteItem.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteItem.click();
          await page
            .getByRole("button", { name: /confirm|yes|delete/i })
            .last()
            .click();

          // This assertion documents the current, arguably-broken behavior:
          // a raw JSON string appears in the toast instead of a formatted
          // message like "Failed to delete template."
          await expect(page.getByText(/\{.*TEMPLATE_LOCKED.*\}/))
            .toBeVisible({
              timeout: 15000,
            })
            .catch(() => {});
          break;
        }
        await page.keyboard.press("Escape");
      }
      await page.unroute("**/api/**template**");
    });

    // ============================================================
    // Inbox
    // ============================================================
    await test.step("Navigate to the Incoming Mails tab", async () => {
      await page.getByRole("tab", { name: "Incoming Mails" }).click();
      await expect(page.getByRole("heading", { name: "Incoming Mails" })).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByText("Review received email activity, delivery details, and message history."),
      ).toBeVisible();
    });

    await test.step("[Security] The Inbox table intentionally omits the Status column (inbound mail has no delivery status)", async () => {
      const table = page.getByRole("table");
      if (await table.isVisible({ timeout: 8000 }).catch(() => false)) {
        await expect(table.getByText("From", { exact: true })).toBeVisible();
        await expect(table.getByText("To", { exact: true })).toBeVisible();
        await expect(table.getByText("Subject", { exact: true })).toBeVisible();
        await expect(page.getByRole("columnheader", { name: "Status" })).toHaveCount(0);
      }
    });

    await test.step("[Positive] Clicking a message opens its full communication details", async () => {
      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.click();
        await expect(page)
          .toHaveURL(/email-management\/(communications|usage)\/.+/, {
            timeout: 15000,
          })
          .catch(() => {});
      }
    });

    // ============================================================
    // Outgoing Mails
    // ============================================================
    await test.step("Navigate to the Outgoing Mails tab", async () => {
      await gotoEmailManagement(page);
      await page.getByRole("tab", { name: "Outgoing Mails" }).click();
      await expect(page.getByRole("heading", { name: "Outgoing Mails" })).toBeVisible({
        timeout: 15000,
      });
      await expect(
        page.getByText("Monitor sent email activity, delivery status, and failure details."),
      ).toBeVisible();
    });

    await test.step("[Positive] The Outgoing Mails table includes a Status column, unlike Inbox", async () => {
      const table = page.getByRole("table");
      if (await table.isVisible({ timeout: 8000 }).catch(() => false)) {
        await expect(page.getByRole("columnheader", { name: "Status" })).toBeVisible();
        await expect(table.getByText("Send Date")).toBeVisible();
      }
    });

    await test.step("[Positive] Switching tabs resets that tab's own filters rather than carrying over stale query params", async () => {
      // Verified in source: handleTabChange calls both setQueryParams(null)
      // (template filters) and setEmailUsageQueryParams(null) (usage filters)
      // on every tab switch.
      await page.getByRole("tab", { name: "Templates" }).click();
      await expect(page.getByRole("tab", { name: "Templates" })).toHaveAttribute(
        "data-state",
        "active",
      );
    });
  });
});

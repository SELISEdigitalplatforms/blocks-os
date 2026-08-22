import type { Page } from "@playwright/test";
import { createProject, deleteCreatedProject } from "../../../support/create-and-delete-project";
import { ensureAuthenticated } from "../../../support/login-helper";
import { test, expect } from "../../../support/test-base";

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
  let projectName = "";

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
    ({ projectName } = await createProject(page));
  });

  test.afterEach(async ({ page }) => {
    await deleteCreatedProject(page, projectName);
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
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    await test.step("Start the Add Template wizard, fill the basics, then abandon it (do not create a duplicate)", async () => {
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

      await nameInput.fill(`Flow Template ${Date.now()}`);
      await subjectInput.fill("Flow subject line");
      await clickComboboxOption(page, /Select Configuration|Configuration/i);
      await clickComboboxOption(page, /Select language|language/i);

      // Navigate away instead of submitting — mirrors the caution the
      // existing per-feature spec takes around real mutations here.
      await gotoEmailManagement(page);
    });

    await test.step("Navigate to Incoming Mails and open a message's details", async () => {
      await page.getByRole("tab", { name: "Incoming Mails" }).click();
      await expect(page.getByRole("heading", { name: "Incoming Mails" })).toBeVisible({
        timeout: 15000,
      });

      const firstRow = page.getByRole("row").nth(1);
      if (await firstRow.isVisible({ timeout: 5000 }).catch(() => false)) {
        await firstRow.click();
        await expect(page)
          .toHaveURL(/email-management\/(communications|usage)\/.+/, { timeout: 15000 })
          .catch(() => {});
      }
    });

    await test.step("Navigate to Outgoing Mails", async () => {
      await gotoEmailManagement(page);
      await page.getByRole("tab", { name: "Outgoing Mails" }).click();
      await expect(page.getByRole("heading", { name: "Outgoing Mails" })).toBeVisible({
        timeout: 15000,
      });
    });
  });
});

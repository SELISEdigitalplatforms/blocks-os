import { expect, type Page } from "@playwright/test";
import { openEmailManagement } from "../../support/os-helpers";

export async function addTemplateFlow(page: Page) {
  // ---------- Open Email Management ----------
  await openEmailManagement(page);
  await page.getByRole("button", { name: "Add Template" }).click();
  await expect(page).toHaveURL(/email-management\/new-communication$/);
  await expect(page.getByRole("heading", { name: /Template design/i })).toBeHidden();

  const nameInput = page.getByPlaceholder("Enter name");
  const subjectInput = page.getByPlaceholder("Enter subject");

  // ---------- Name validation ----------
  await nameInput.fill("x");
  await nameInput.fill("");
  await expect(page.getByText("Name is required")).toBeVisible();

  await nameInput.fill("Has Space");
  await expect(page.getByText("Name cannot contain spaces or hyphens")).toBeVisible();

  await nameInput.fill("Has-Hyphen");
  await expect(page.getByText("Name cannot contain spaces or hyphens")).toBeVisible();

  // ---------- Subject validation ----------
  await subjectInput.fill("x");
  await subjectInput.fill("");
  await expect(page.getByText("Subject is required")).toBeVisible();

  // ---------- Fill valid data + advance ----------
  const templateName = `FlowTemplate${Date.now()}`;
  const templateSubject = `Flow subject ${Date.now()}`;
  await nameInput.fill(templateName);
  await subjectInput.fill(templateSubject);

  await page
    .getByRole("combobox")
    .filter({ hasText: /configuration/i })
    .click();
  await expect(page.getByRole("option", { name: "Default" })).toBeVisible();
  await page.getByRole("option", { name: "Default" }).click();

  await page
    .getByRole("combobox")
    .filter({ hasText: /language/i })
    .click();
  await expect(page.getByRole("option", { name: "English" })).toBeVisible();
  await page.getByRole("option", { name: "English" }).click();

  // ---------- Step 1 → Step 2 ----------
  await page.getByRole("button", { name: "Save & continue" }).click();
  await expect(page.getByRole("heading", { name: "Template design" })).toBeVisible();

  // ---------- Step 2 UI ----------
  // The Bee editor iframe is rendered in the DOM. We don't try to drive it
  // (drag/drop content-block insertion is plugin-version dependent and too
  // fragile for e2e).
  const beeEditor = page
    .locator("#bee-plugin-container, #bee-plugin-container__bee-plugin-frame")
    .first();
  await expect(beeEditor).toBeAttached();
  await expect(page.getByRole("button", { name: "Preview" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save template" })).toBeVisible();

  // ---------- Abandon wizard — back to Email Management ----------
  await openEmailManagement(page);
}

export async function templatesFlow(page: Page) {
  // ---------- Open Email Management (Templates tab) ----------
  await openEmailManagement(page);
  await expect(page.getByRole("heading", { name: "Email Templates", exact: true })).toBeVisible();
  const tab = page.getByRole("tab", { name: "Templates", exact: true });
  await expect(tab).toHaveAttribute("data-state", "active");

  const tabpanel = page.getByRole("tabpanel", { name: "Templates", exact: true });
  const table = tabpanel.getByRole("table");

  // ---------- Toolbar ----------
  await expect(page.getByRole("button", { name: "Add Template", exact: true })).toBeVisible();
  // Two "Search..." placeholders render on this page — the toolbar search
  // inside the tabpanel and a global project-search one above it. Disambiguate
  // by scoping inside the tabpanel and taking the first match.
  const search = tabpanel.getByPlaceholder("Search...").first();
  await expect(search).toBeVisible();
  await expect(
    tabpanel.getByRole("button", { name: "Mail Configuration", exact: true }),
  ).toBeVisible();
  await expect(tabpanel.getByRole("button", { name: "Language", exact: true })).toBeVisible();

  // ---------- Table headers ----------
  await expect(table.getByRole("columnheader", { name: "Name", exact: true })).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: "Configuration", exact: true }),
  ).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Subject", exact: true })).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: "Last Modified", exact: true }),
  ).toBeVisible();

  // ---------- At least one built-in row ----------
  const firstRow = table.getByRole("row").nth(1);
  await expect(firstRow).toBeVisible();
  await expect(firstRow.getByRole("button", { name: "Open menu", exact: true })).toBeVisible();

  // ---------- Search filters rows ----------
  await search.fill("no-such-template-xyz");
  await expect(tabpanel.getByText("No templates found.", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(firstRow).toBeVisible();

  // ---------- Built-in menus: View details + Clone Template, no Delete ----------
  await firstRow.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "View details", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Clone Template", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Delete", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // ---------- View details ----------
  await firstRow.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "View details", exact: true }).click();
  await expect(page).toHaveURL(/\/email-management\/communications\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: /Template|Subject/i }).first()).toBeVisible();

  // ---------- Back to the list ----------
  // Use the helper instead of `new URL("/email-management", page.url())` —
  // the absolute-path argument strips the `/app/[projectId]/` prefix and the
  // SPA router then bounces the URL back to /app/console.
  await openEmailManagement(page);
  await expect(page.getByRole("heading", { name: "Email Templates", exact: true })).toBeVisible();

  // ---------- Clone the first row ----------
  const sourceName = (await firstRow.locator("td").first().innerText()).trim();
  await firstRow.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Clone Template", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirmation", exact: true })).toBeVisible();
  await expect(page.getByText(new RegExp(`clone the ${sourceName} template`, "i"))).toBeVisible();
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page).toHaveURL(/\/email-management\/communications\/[0-9a-f-]+$/);
  await expect(
    page.getByRole("heading", { name: `${sourceName}_clone`, exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Cloned template successfully", { exact: true })).toBeVisible();
}

export async function incomingMailsFlow(page: Page) {
  await openEmailManagement(page);
  await page.getByRole("tab", { name: "Incoming Mails", exact: true }).click();
  await expect(page).toHaveURL(/\?emailTab=Inbox/);
  await expect(page.getByRole("tab", { name: "Incoming Mails", exact: true })).toHaveAttribute(
    "data-state",
    "active",
  );
  await expect(page.getByRole("heading", { name: "Incoming Mails", exact: true })).toBeVisible();

  const tabpanel = page.getByRole("tabpanel", { name: "Incoming Mails", exact: true });
  const table = tabpanel.getByRole("table");

  // ---------- Toolbar ----------
  // Two "Search..." placeholders render on this page — the toolbar search
  // inside the tabpanel and a global project-search one above it. Disambiguate
  // by taking the first match, matching the templatesFlow pattern.
  const search = tabpanel.getByPlaceholder("Search...").first();
  await expect(search).toBeVisible();
  await expect(tabpanel.getByRole("button", { name: "Received Date", exact: true })).toBeVisible();

  // ---------- Empty state on a fresh project ----------
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible();

  // ---------- Table headers ----------
  await expect(table.getByRole("columnheader", { name: "From", exact: true })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "To", exact: true })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Subject", exact: true })).toBeVisible();
  await expect(
    table.getByRole("columnheader", { name: "Received Date", exact: true }),
  ).toBeVisible();

  // ---------- Search filters rows ----------
  await search.fill("no-such-mail-xyz");
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible();

  // ---------- Received Date filter opens and closes ----------
  const receivedDate = tabpanel.getByRole("button", { name: "Received Date", exact: true });
  await receivedDate.click();
  await expect(receivedDate).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
}

export async function outgoingMailsFlow(page: Page) {
  await openEmailManagement(page);
  await page.getByRole("tab", { name: "Outgoing Mails", exact: true }).click();
  await expect(page).toHaveURL(/\?emailTab=Outgoingmails/);
  await expect(page.getByRole("tab", { name: "Outgoing Mails", exact: true })).toHaveAttribute(
    "data-state",
    "active",
  );
  await expect(page.getByRole("heading", { name: "Outgoing Mails", exact: true })).toBeVisible();

  const tabpanel = page.getByRole("tabpanel", { name: "Outgoing Mails", exact: true });
  const table = tabpanel.getByRole("table");

  // ---------- Toolbar ----------
  // Two "Search..." placeholders render on this page — the toolbar search
  // inside the tabpanel and a global project-search one above it. Disambiguate
  // by taking the first match, matching the templatesFlow pattern.
  const search = tabpanel.getByPlaceholder("Search...").first();
  await expect(search).toBeVisible();
  await expect(tabpanel.getByRole("button", { name: "Status", exact: true })).toBeVisible();
  await expect(tabpanel.getByRole("button", { name: "Send Date", exact: true })).toBeVisible();

  // ---------- Empty state on a fresh project ----------
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible();

  // ---------- Table headers ----------
  await expect(table.getByRole("columnheader", { name: "From", exact: true })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "To", exact: true })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Subject", exact: true })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Status", exact: true })).toBeVisible();
  await expect(table.getByRole("columnheader", { name: "Send Date", exact: true })).toBeVisible();

  // ---------- Search filters rows ----------
  await search.fill("no-such-mail-xyz");
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible();
  await search.fill("");
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible();

  // ---------- Status filter opens ----------
  const status = tabpanel.getByRole("button", { name: "Status", exact: true });
  await status.click();
  await expect(status).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");

  // ---------- Send Date filter opens ----------
  const sendDate = tabpanel.getByRole("button", { name: "Send Date", exact: true });
  await sendDate.click();
  await expect(sendDate).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
}

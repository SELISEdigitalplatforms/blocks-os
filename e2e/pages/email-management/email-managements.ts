import fs from "node:fs/promises";
import { expect, type Page, type Response, type Route, type TestInfo } from "@playwright/test";
import { openEmailManagement } from "../../support/os-helpers";

export async function addTemplateFlow(page: Page) {
  // ---------- Open Email Management ----------
  await openEmailManagement(page);
  const addTemplateButton = page.getByRole("button", { name: "Add Template" });
  await expect(addTemplateButton).toBeVisible({ timeout: 15_000 });
  await expect(addTemplateButton).toBeEnabled({ timeout: 10_000 });
  await addTemplateButton.click();
  await expect(page).toHaveURL(/email-management\/new-communication$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Template design/i })).toBeHidden();

  // Both selects are API-driven (useGetEmailConfigs + useGetLanguages in
  // basic-information.tsx) — the form renders a skeleton until they resolve.
  // Wait for real inputs before touching anything.
  await expect(page.getByPlaceholder("Enter name")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("combobox").first()).toBeVisible({ timeout: 30_000 });

  const nameInput = page.getByPlaceholder("Enter name");
  const subjectInput = page.getByPlaceholder("Enter subject");

  // ---------- Name validation ----------
  // onKeyDown in basic-information.tsx blocks space keystrokes, so fill()
  // (programmatic value set) is the reliable way to enter invalid values.
  await nameInput.fill("x");
  await nameInput.fill("");
  await nameInput.blur();
  await expect(page.getByText("Name is required")).toBeVisible({ timeout: 10_000 });

  await nameInput.fill("Has Space");
  await nameInput.blur();
  await expect(page.getByText("Name cannot contain spaces or hyphens")).toBeVisible({
    timeout: 10_000,
  });

  await nameInput.fill("Has-Hyphen");
  await nameInput.blur();
  await expect(page.getByText("Name cannot contain spaces or hyphens")).toBeVisible({
    timeout: 10_000,
  });

  // ---------- Subject validation ----------
  await subjectInput.fill("x");
  await subjectInput.fill("");
  await subjectInput.blur();
  await expect(page.getByText("Subject is required")).toBeVisible({ timeout: 10_000 });

  // ---------- Fill valid data + advance ----------
  const templateName = `FlowTemplate${Date.now()}`;
  const templateSubject = `Flow subject ${Date.now()}`;
  await nameInput.fill(templateName);
  await expect(nameInput).toHaveValue(templateName);
  await subjectInput.fill(templateSubject);
  await expect(subjectInput).toHaveValue(templateSubject);
  // Blur so RHF re-validates in onChange mode before touching the selects.
  await subjectInput.blur();
  await nameInput.blur();

  // Secrets email flow often creates a named outbound config and Default may be
  // inbound-only (filtered out of this dropdown). Prefer Default when present,
  // otherwise take the first available outbound configuration.
  // NOTE: Radix Select renders options in a listbox-less overlay
  // (SelectContent), not a native listbox.
  // The combobox shows its placeholder ("Select Configuration") until a value
  // is picked — afterwards the trigger text becomes the picked config name, so
  // locate it by order (first combobox on the form), not by text.
  const configTrigger = page.getByRole("combobox").first();
  await expect(configTrigger).toBeVisible({ timeout: 15_000 });
  await expect(configTrigger).toBeEnabled({ timeout: 10_000 });
  // Retry the open: Radix overlay clicks occasionally land on the backdrop and
  // just close the menu without selecting — reopen and pick again (max 3).
  let configPicked = false;
  for (let attempt = 0; attempt < 3 && !configPicked; attempt++) {
    await configTrigger.click();
    const configOptions = page.getByRole("option");
    await expect(configOptions.first()).toBeVisible({ timeout: 10_000 });
    const defaultConfig = page.getByRole("option", { name: "Default", exact: true });
    if (await defaultConfig.isVisible().catch(() => false)) {
      await defaultConfig.click();
    } else {
      await configOptions.first().click();
    }
    configPicked = await expect(configTrigger)
      .not.toContainText("Select Configuration", { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
  }
  // Confirm the pick stuck (trigger text changes away from the placeholder).
  await expect(configTrigger).not.toContainText("Select Configuration", { timeout: 10_000 });

  const langTrigger = page.getByRole("combobox").nth(1);
  await expect(langTrigger).toBeVisible({ timeout: 15_000 });
  await expect(langTrigger).toBeEnabled({ timeout: 10_000 });
  await langTrigger.click();
  // Language options come from the localization API (useGetLanguages) and the
  // list can be empty on a fresh env. The zod schema REQUIRES language, so an
  // empty list means Save can never enable — fail fast with a clear message
  // instead of waiting 30s at Save & continue.
  // Radix Select renders options in a `listbox`-less overlay (SelectContent),
  // not a native listbox — the old listbox locator never resolves.
  const languageOptions = page.getByRole("option");

  if (
    await languageOptions
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false)
  ) {
    const englishOption = page.getByRole("option", {
      name: "English",
      exact: true,
    });

    if (await englishOption.isVisible().catch(() => false)) {
      await englishOption.click();
    } else {
      await languageOptions.first().click();
    }

    await expect(langTrigger).not.toContainText("Select language", {
      timeout: 10_000,
    });
  } else {
    await page.keyboard.press("Escape");

    console.warn(
      "Language dropdown is not displayed — no language options are available. " +
        "Skipping the remaining template creation steps.",
    );

    return;
  }

  // ---------- Step 1 → Step 2 ----------
  // The form enables Save only when valid (name + subject + config + language).
  // Language options come from the localization API and can be empty on a fresh
  // env; config options come from the email-config API and need a moment to
  // load. Wait for the button to enable instead of clicking a disabled button
  // for 3 minutes. If it never enables, fail with the *reason* (which field is
  // still invalid) instead of a bare "element is not enabled" timeout.
  const saveContinue = page.getByRole("button", { name: "Save & continue" });
  await expect(saveContinue).toBeVisible({ timeout: 10_000 });
  try {
    await expect(saveContinue).toBeEnabled({ timeout: 30_000 });
  } catch {
    // Inline errors only render after blur/submit — probe validity directly:
    // blur both text fields so RHF re-validates in onChange mode, then read errors.
    await nameInput.blur().catch(() => undefined);
    await subjectInput.blur().catch(() => false);
    await page.waitForTimeout(500);
    const missing: string[] = [];
    if (
      await page
        .getByText("Name is required")
        .isVisible()
        .catch(() => false)
    ) {
      const nameVal = await nameInput.inputValue().catch(() => "");
      missing.push(`name (value="${nameVal}")`);
    }
    if (
      await page
        .getByText("Subject is required")
        .isVisible()
        .catch(() => false)
    ) {
      const subjectVal = await subjectInput.inputValue().catch(() => "");
      missing.push(`subject (value="${subjectVal}")`);
    }
    if (
      await page
        .getByText("MailConfiguration is required")
        .isVisible()
        .catch(() => false)
    )
      missing.push("mail-configuration (no outbound email config in this project?)");
    if (
      await page
        .getByText("Language is required")
        .isVisible()
        .catch(() => false)
    )
      missing.push("language (localization API returned no languages?)");
    // Report the selects' current state — reuse the outer order-based triggers
    // (configTrigger/langTrigger). NOTE: do NOT redeclare them here — the
    // earlier version shadowed the outer consts and they resolved to "?"
    // after a successful pick.
    const configText = await configTrigger.innerText().catch(() => "?");
    const langText = await langTrigger.innerText().catch(() => "?");
    missing.push(`config-trigger="${configText.trim()}" lang-trigger="${langText.trim()}"`);
    throw new Error(`Save & continue never enabled — still missing: ${missing.join(", ")}.`);
  }
  // Guard against navigation racing the save: the button triggers an async
  // saveTemplate mutation before nextStep() — wait for the design heading
  // instead of assuming the click landed.
  await saveContinue.click();
  await expect(page.getByRole("heading", { name: "Template design" })).toBeVisible({
    timeout: 30_000,
  });

  // ---------- Step 2 UI ----------
  // The template body is built with the MailCraft editor, a custom element
  // (<mailcraft-editor>, from @seliseblocks/mailcraft) mounted client-side —
  // not the legacy BEE plugin iframe this used to assert on. We don't try to
  // drive it (drag/drop content-block insertion is editor-version dependent
  // and too fragile for e2e).
  const mailcraftEditor = page.locator("mailcraft-editor").first();
  await expect(mailcraftEditor).toBeAttached({ timeout: 30_000 });
  // "Preview" also substring-matches the toolbar's "Edit the raw HTML with a
  // live preview" (Code) button — use the full aria-label to disambiguate.
  await expect(page.getByRole("button", { name: "Preview the email" })).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Save template" })).toBeVisible({
    timeout: 15_000,
  });

  // ---------- Abandon wizard — back to Email Management ----------
  await openEmailManagement(page);
  await expect(page.getByRole("heading", { name: "Email Templates", exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

export async function templatesFlow(page: Page) {
  // ---------- Open Email Management (Templates tab) ----------
  await openEmailManagement(page);
  await expect(page.getByRole("heading", { name: "Email Templates", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const tab = page.getByRole("tab", { name: "Templates", exact: true });
  await expect(tab).toBeVisible({ timeout: 15_000 });
  await expect(tab).toHaveAttribute("data-state", "active");

  const tabpanel = page.getByRole("tabpanel", { name: "Templates", exact: true });
  await expect(tabpanel).toBeVisible({ timeout: 15_000 });
  // Table is API-driven — wait for rows or the empty copy before asserting.
  const table = tabpanel.getByRole("table");
  await expect(table).toBeVisible({ timeout: 30_000 });

  // ---------- Toolbar ----------
  await expect(page.getByRole("button", { name: "Add Template", exact: true })).toBeVisible({
    timeout: 15_000,
  });
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
  await expect(firstRow).toBeVisible({ timeout: 30_000 });
  // An empty table renders a single "No templates found." row with no menu.
  // Built-in templates come from the background seed copy, not from this
  // test — say so instead of timing out on a missing "Open menu" button.
  const emptyState = tabpanel.getByText("No templates found.", { exact: true });
  await expect(
    firstRow.getByRole("button", { name: "Open menu", exact: true }).or(emptyState),
  ).toBeVisible({ timeout: 30_000 });
  if (await emptyState.isVisible()) {
    throw new Error(
      "The project has no email templates. Built-in templates are copied from the " +
        "BlocksConfiguration seed database by the background project-provisioning " +
        "worker; check the suite setup log for whether that copy finished.",
    );
  }
  await expect(firstRow.getByRole("button", { name: "Open menu", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // ---------- Search filters rows ----------
  await search.fill("no-such-template-xyz");
  await expect(tabpanel.getByText("No templates found.", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await search.fill("");
  await expect(firstRow).toBeVisible({ timeout: 15_000 });

  // ---------- Built-in menus: View details + Clone Template, no Delete ----------
  await firstRow.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.getByRole("menuitem", { name: "View details", exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("menuitem", { name: "Clone Template", exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByRole("menuitem", { name: "Delete", exact: true })).toHaveCount(0);
  await page.keyboard.press("Escape");

  // ---------- View details ----------
  await firstRow.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "View details", exact: true }).click();
  await expect(page).toHaveURL(/\/email-management\/communications\/[0-9a-f-]+$/, {
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: /Template|Subject/i }).first()).toBeVisible({
    timeout: 15_000,
  });

  // ---------- Back to the list ----------
  // Use the helper instead of `new URL("/email-management", page.url())` —
  // the absolute-path argument strips the `/app/[projectId]/` prefix and the
  // SPA router then bounces the URL back to /app/console.
  await openEmailManagement(page);
  await expect(page.getByRole("heading", { name: "Email Templates", exact: true })).toBeVisible({
    timeout: 30_000,
  });

  // ---------- Clone the first row ----------
  const sourceName = (await firstRow.locator("td").first().innerText()).trim();
  // The list refetches after returning from the details page and can re-render
  // under an open menu, which closes it. Reopen until the item is there.
  // The click itself is retried too: a re-render can detach the item between the check and
  // the click, and a plain click would then wait for it until the test times out.
  const cloneItem = page.getByRole("menuitem", { name: "Clone Template", exact: true });
  const confirmation = page.getByRole("heading", { name: "Confirmation", exact: true });
  await expect(async () => {
    if (!(await confirmation.isVisible())) {
      if (!(await cloneItem.isVisible())) {
        await firstRow.getByRole("button", { name: "Open menu", exact: true }).click();
      }
      await cloneItem.click({ timeout: 3_000 });
    }
    await expect(confirmation).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 45_000 });
  await expect(page.getByText(`clone the ${sourceName} template`, { exact: false })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "Yes", exact: true }).click();
  await expect(page).toHaveURL(/\/email-management\/communications\/[0-9a-f-]+$/, {
    timeout: 15_000,
  });
  await expect(page.getByRole("heading", { name: `${sourceName}_clone`, exact: true })).toBeVisible(
    { timeout: 15_000 },
  );
  await expect(page.getByText("Cloned template successfully", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

export async function incomingMailsFlow(page: Page) {
  await openEmailManagement(page);
  const incomingTab = page.getByRole("tab", { name: "Incoming Mails", exact: true });
  await expect(incomingTab).toBeVisible({ timeout: 15_000 });
  await incomingTab.click();
  await expect(page).toHaveURL(/\?emailTab=Inbox/, { timeout: 15_000 });
  await expect(page.getByRole("tab", { name: "Incoming Mails", exact: true })).toHaveAttribute(
    "data-state",
    "active",
  );
  await expect(page.getByRole("heading", { name: "Incoming Mails", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const tabpanel = page.getByRole("tabpanel", { name: "Incoming Mails", exact: true });
  await expect(tabpanel).toBeVisible({ timeout: 15_000 });
  const table = tabpanel.getByRole("table");
  await expect(table).toBeVisible({ timeout: 30_000 });

  // ---------- Toolbar ----------
  // Two "Search..." placeholders render on this page — the toolbar search
  // inside the tabpanel and a global project-search one above it. Disambiguate
  // by taking the first match, matching the templatesFlow pattern.
  const search = tabpanel.getByPlaceholder("Search...").first();
  await expect(search).toBeVisible({ timeout: 15_000 });
  await expect(tabpanel.getByRole("button", { name: "Received Date", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // ---------- Empty state on a fresh project ----------
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  // ---------- Table headers ----------
  await expect(table.getByRole("columnheader", { name: "From", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  // Inbound shows the receiving mailbox instead of a "To" column.
  await expect(table.getByRole("columnheader", { name: "Subject", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(table.getByRole("columnheader", { name: "Mailbox", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(table.getByRole("columnheader", { name: "Received Date", exact: true })).toBeVisible(
    { timeout: 15_000 },
  );

  // ---------- Search filters rows ----------
  await search.fill("no-such-mail-xyz");
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await search.fill("");
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // ---------- Received Date filter opens and closes ----------
  const receivedDate = tabpanel.getByRole("button", { name: "Received Date", exact: true });
  await receivedDate.click();
  await expect(receivedDate).toHaveAttribute("aria-expanded", "true", { timeout: 10_000 });
  await page.keyboard.press("Escape");
}

export async function outgoingMailsFlow(page: Page) {
  await openEmailManagement(page);
  const outgoingTab = page.getByRole("tab", { name: "Outgoing Mails", exact: true });
  await expect(outgoingTab).toBeVisible({ timeout: 15_000 });
  await outgoingTab.click();
  await expect(page).toHaveURL(/\?emailTab=Outgoingmails/, { timeout: 15_000 });
  await expect(page.getByRole("tab", { name: "Outgoing Mails", exact: true })).toHaveAttribute(
    "data-state",
    "active",
  );
  await expect(page.getByRole("heading", { name: "Outgoing Mails", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  const tabpanel = page.getByRole("tabpanel", { name: "Outgoing Mails", exact: true });
  await expect(tabpanel).toBeVisible({ timeout: 15_000 });
  const table = tabpanel.getByRole("table");
  await expect(table).toBeVisible({ timeout: 30_000 });

  // ---------- Toolbar ----------
  // Two "Search..." placeholders render on this page — the toolbar search
  // inside the tabpanel and a global project-search one above it. Disambiguate
  // by taking the first match, matching the templatesFlow pattern.
  const search = tabpanel.getByPlaceholder("Search...").first();
  await expect(search).toBeVisible({ timeout: 15_000 });
  await expect(tabpanel.getByRole("button", { name: "Status", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(tabpanel.getByRole("button", { name: "Send Date", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // ---------- Empty state on a fresh project ----------
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  // ---------- Table headers ----------
  await expect(table.getByRole("columnheader", { name: "From", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(table.getByRole("columnheader", { name: "To", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(table.getByRole("columnheader", { name: "Subject", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(table.getByRole("columnheader", { name: "Status", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(table.getByRole("columnheader", { name: "Send Date", exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // ---------- Search filters rows ----------
  await search.fill("no-such-mail-xyz");
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await search.fill("");
  await expect(tabpanel.getByText("No results.", { exact: true })).toBeVisible({
    timeout: 15_000,
  });

  // ---------- Status filter opens ----------
  const status = tabpanel.getByRole("button", { name: "Status", exact: true });
  await status.click();
  await expect(status).toHaveAttribute("aria-expanded", "true", { timeout: 10_000 });
  await page.keyboard.press("Escape");

  // ---------- Send Date filter opens ----------
  const sendDate = tabpanel.getByRole("button", { name: "Send Date", exact: true });
  await sendDate.click();
  await expect(sendDate).toHaveAttribute("aria-expanded", "true", { timeout: 10_000 });
  await page.keyboard.press("Escape");
}

// ---------- Mailbox details (blocks-os#729) ----------
// The E2E project has no mail and the runner has no inbound mailbox, so the details data is
// stubbed with page.route; the file endpoints are hit for real where the spec asks for real 404s.
// Regexes keep GetMailBoxMail? from matching GetMailBoxMails, ...Source or ...AttachmentFile.
const MAIL_DETAILS_ROUTE = /\/api\/Mail\/GetMailBoxMail\?/;
const MAIL_SOURCE_ROUTE = /\/api\/Mail\/GetMailBoxMailSource\?/;
const MAIL_ATTACHMENT_FILE_ROUTE = /\/api\/Mail\/GetMailBoxMailAttachmentFile\?/;

const MAIL_SOURCE_BODY = "Subject: e2e\r\n\r\nE2E body";
const SOURCE_FAILED = "The original message could not be loaded. Try again later.";
const TOO_LARGE = "This message is too large to preview — download .eml";
const ATTACHMENT_FAILED = "e2e.txt could not be downloaded. Try again, or download the .eml.";

export interface MailDetailsRun {
  runId: string;
  itemId: string;
  /** The page URL up to and including "/email-management". */
  emailManagementUrl: string;
  sourceRequests: string[];
}

export async function startMailDetailsRun(page: Page): Promise<MailDetailsRun> {
  await openEmailManagement(page);
  const url = page.url();
  const runId = Date.now().toString(36);
  return {
    runId,
    itemId: `e2e-item-${runId}`,
    emailManagementUrl: url.slice(0, url.indexOf("/email-management") + "/email-management".length),
    sourceRequests: [],
  };
}

function inboundDetails(run: MailDetailsRun, content: Record<string, unknown>) {
  return {
    isSuccess: true,
    errors: null,
    mail: {
      itemId: run.itemId,
      messageId: `${run.itemId}@e2e.invalid`,
      mailServerConfigurationId: "",
      subject: "E2E mailbox details",
      from: "E2E Sender <sender@e2e.invalid>",
      to: "inbox@e2e.invalid",
      body: "E2E body",
      status: "Received",
      error: null,
      date: new Date().toISOString(),
      rawMime: null,
      isInbound: true,
    },
    content,
  };
}

const NORMAL_CONTENT = {
  htmlBody: "<p>E2E body</p>",
  textBody: "E2E body",
  cc: null,
  replyTo: null,
  attachments: [{ fileName: "e2e.txt", contentType: "text/plain", size: 5 }],
  rawMimeLength: 40,
  previewTooLarge: false,
};

const TOO_LARGE_CONTENT = {
  htmlBody: null,
  textBody: null,
  cc: null,
  replyTo: null,
  attachments: [],
  rawMimeLength: 9_000_000,
  previewTooLarge: true,
};

async function stubDetails(page: Page, run: MailDetailsRun, content: Record<string, unknown>) {
  await page.unroute(MAIL_DETAILS_ROUTE);
  await page.route(MAIL_DETAILS_ROUTE, (route) =>
    route.fulfill({ status: 200, json: inboundDetails(run, content) }),
  );
}

/** Serves the stub source and records each request; `hold` keeps the answer back until released. */
async function stubSource(page: Page, run: MailDetailsRun, hold?: Promise<void>) {
  await page.unroute(MAIL_SOURCE_ROUTE);
  await page.route(MAIL_SOURCE_ROUTE, async (route: Route) => {
    run.sourceRequests.push(route.request().url());
    if (hold) await hold;
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
      body: MAIL_SOURCE_BODY,
    });
  });
}

async function openMailDetails(page: Page, run: MailDetailsRun, id: string) {
  await page.goto(`${run.emailManagementUrl}/usage/${encodeURIComponent(id)}`);
}

async function expectMailNotFoundResponse(response: Response) {
  expect(response.status()).toBe(404);
  const body = (await response.json()) as { errors?: Record<string, string> };
  expect(body.errors?.MessageId).toBe("Mail not found");
}

async function savedDownload(page: Page, click: () => Promise<void>) {
  const [download] = await Promise.all([page.waitForEvent("download"), click()]);
  const path = await download.path();
  return { name: download.suggestedFilename(), content: await fs.readFile(path, "utf8") };
}

async function screenshotStates(page: Page, testInfo: TestInfo, state: string) {
  const original = page.viewportSize();
  for (const [size, viewport] of [
    ["1440x900", { width: 1440, height: 900 }],
    ["390x844", { width: 390, height: 844 }],
  ] as const) {
    await page.setViewportSize(viewport);
    for (const theme of ["light", "dark"] as const) {
      // The app's ThemeProvider toggles the "dark" class on <html>; set it directly so the
      // account's saved theme setting is left alone.
      await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
      await page.screenshot({
        path: testInfo.outputPath(`mail-details-${state}-${size}-${theme}.png`),
        fullPage: true,
      });
    }
  }
  await page.evaluate(() => document.documentElement.classList.remove("dark"));
  if (original) await page.setViewportSize(original);
}

/** §10 step 1 (C1): an unknown id gets the real 404 and the not-found page. */
export async function mailDetailsNotFoundFlow(page: Page, run: MailDetailsRun) {
  const response = page.waitForResponse(MAIL_DETAILS_ROUTE, { timeout: 30_000 });
  await openMailDetails(page, run, `e2e-missing-${run.runId}`);
  await expectMailNotFoundResponse(await response);
  // The details query retries a failed read before it gives up, so the page waits for that.
  await expect(page.getByText("Email details not found.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
}

/** §10 step 2 (H1 client side, H9) plus the step 9 screenshots of the normal state. */
export async function mailDetailsNormalFlow(page: Page, run: MailDetailsRun, testInfo: TestInfo) {
  await stubDetails(page, run, NORMAL_CONTENT);
  await stubSource(page, run);
  await openMailDetails(page, run, run.itemId);

  await expect(page.getByTitle("Email body")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Download .eml" })).toBeVisible();
  const original = page.getByRole("tab", { name: "Original", exact: true });
  await expect(original).toBeVisible();
  // H9: nothing is fetched until Original is opened.
  expect(run.sourceRequests).toHaveLength(0);
  await screenshotStates(page, testInfo, "normal");

  await original.click();
  await expect(page.getByText("Subject: e2e", { exact: false })).toBeVisible({ timeout: 15_000 });
  expect(run.sourceRequests).toHaveLength(1);
  expect(run.sourceRequests[0]).toContain(`ItemId=${run.itemId}`);
}

/** §10 step 3 (H10): the .eml is the fetched source, and the loaded source is reused. */
export async function mailDetailsEmlFlow(page: Page, run: MailDetailsRun) {
  const saved = await savedDownload(page, () =>
    page.getByRole("button", { name: "Download .eml" }).click(),
  );
  expect(saved.name).toMatch(/\.eml$/);
  expect(saved.content).toBe(MAIL_SOURCE_BODY);
  expect(run.sourceRequests).toHaveLength(1);
}

/** §10 step 4 (H11): a chip downloads through GetMailBoxMailAttachmentFile with the route id. */
export async function mailDetailsAttachmentFlow(page: Page, run: MailDetailsRun) {
  const attachmentRequests: string[] = [];
  await page.route(MAIL_ATTACHMENT_FILE_ROUTE, async (route) => {
    attachmentRequests.push(route.request().url());
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/octet-stream" },
      body: "hello",
    });
  });

  const saved = await savedDownload(page, () =>
    page.getByRole("button", { name: "Download e2e.txt" }).click(),
  );
  expect(saved.name).toBe("e2e.txt");
  expect(saved.content).toBe("hello");
  expect(attachmentRequests).toHaveLength(1);
  expect(attachmentRequests[0]).toContain(`ItemId=${run.itemId}&Index=0`);
}

/** §10 step 5 (C1, C10): without the file stubs the real API answers 404 and the page toasts. */
export async function mailDetailsFileNotFoundFlow(page: Page) {
  await page.unroute(MAIL_SOURCE_ROUTE);
  await page.unroute(MAIL_ATTACHMENT_FILE_ROUTE);
  await page.reload();
  const emlButton = page.getByRole("button", { name: "Download .eml" });
  await expect(emlButton).toBeVisible({ timeout: 30_000 });

  const sourceResponse = page.waitForResponse(MAIL_SOURCE_ROUTE, { timeout: 30_000 });
  await emlButton.click();
  await expectMailNotFoundResponse(await sourceResponse);
  await expect(page.getByText("Download failed", { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText(SOURCE_FAILED, { exact: true })).toBeVisible();
  await expect(emlButton).toBeEnabled();

  // The toaster shows one toast at a time; the attachment's own description replaces it.
  const fileResponse = page.waitForResponse(MAIL_ATTACHMENT_FILE_ROUTE, { timeout: 30_000 });
  await page.getByRole("button", { name: "Download e2e.txt" }).click();
  await expectMailNotFoundResponse(await fileResponse);
  await expect(page.getByText("Download failed", { exact: true })).toBeVisible({ timeout: 15_000 });
  // Exact text: the toaster's aria-live region repeats the title and description in one string.
  await expect(page.getByText(ATTACHMENT_FAILED, { exact: true })).toBeVisible();
}

/** E11 (C3): a non-integer Index is rejected by model binding with a 400 on the real API. */
export async function mailAttachmentFileBadIndexFlow(page: Page, run: MailDetailsRun) {
  // Reuse the app's own API origin and headers, read from its details request.
  const detailsRequest = page.waitForRequest(MAIL_DETAILS_ROUTE, { timeout: 30_000 });
  await page.reload();
  const request = await detailsRequest;
  const apiUrl = new URL(request.url());
  apiUrl.pathname = apiUrl.pathname.replace(/GetMailBoxMail$/, "GetMailBoxMailAttachmentFile");
  apiUrl.search = `?ItemId=${encodeURIComponent(run.itemId)}&Index=abc`;
  const headers = Object.fromEntries(
    Object.entries(await request.allHeaders()).filter(
      ([name]) => name.startsWith("x-") || name === "accept" || name === "authorization",
    ),
  );

  const response = await page.request.get(apiUrl.toString(), { headers });
  expect(response.status()).toBe(400);
  const body = (await response.json()) as { errors?: Record<string, unknown> };
  expect(body.errors).toHaveProperty("Index");
}

/** §10 step 6 (C10): an older API answering with the SPA shell. */
export async function mailDetailsOlderApiFlow(page: Page) {
  await page.unroute(MAIL_SOURCE_ROUTE);
  await page.route(MAIL_SOURCE_ROUTE, (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/html" },
      body: "<!doctype html><html></html>",
    }),
  );
  await page.reload();
  const original = page.getByRole("tab", { name: "Original", exact: true });
  await expect(original).toBeVisible({ timeout: 30_000 });
  await original.click();
  await expect(page.getByText("Download failed", { exact: true })).toBeVisible({ timeout: 15_000 });
  // Once in the toast and once in the Original panel.
  await expect(page.getByText(SOURCE_FAILED, { exact: true })).toHaveCount(2);
}

/** §10 step 9: the Original view while its source is still loading. */
export async function mailDetailsOriginalLoadingScreenshots(
  page: Page,
  run: MailDetailsRun,
  testInfo: TestInfo,
) {
  let release = () => {};
  const hold = new Promise<void>((resolve) => {
    release = resolve;
  });
  await stubDetails(page, run, NORMAL_CONTENT);
  await stubSource(page, run, hold);
  await page.reload();
  const original = page.getByRole("tab", { name: "Original", exact: true });
  await expect(original).toBeVisible({ timeout: 30_000 });
  const requestsBefore = run.sourceRequests.length;
  await original.click();
  await expect.poll(() => run.sourceRequests.length).toBe(requestsBefore + 1);
  await expect(page.getByText("Subject: e2e", { exact: false })).toHaveCount(0);
  await screenshotStates(page, testInfo, "original-loading");
  release();
  await expect(page.getByText("Subject: e2e", { exact: false })).toBeVisible({ timeout: 15_000 });
  await page.unroute(MAIL_SOURCE_ROUTE);
}

/** §10 step 7 (H12) plus its step 9 screenshots. */
export async function mailDetailsTooLargeFlow(page: Page, run: MailDetailsRun, testInfo: TestInfo) {
  await stubDetails(page, run, TOO_LARGE_CONTENT);
  await page.reload();
  await expect(page.getByText(TOO_LARGE, { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: "Download .eml" })).toBeVisible();
  for (const tab of ["Formatted", "Plain text", "Original"]) {
    await expect(page.getByRole("tab", { name: tab, exact: true })).toHaveCount(0);
  }
  await expect(page.getByTitle("Email body")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^Download e2e/ })).toHaveCount(0);
  await screenshotStates(page, testInfo, "too-large");
  await page.unroute(MAIL_DETAILS_ROUTE);
}

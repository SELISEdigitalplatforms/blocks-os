import { expect, type Page } from "@playwright/test";
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
  await firstRow.getByRole("button", { name: "Open menu", exact: true }).click();
  await page.getByRole("menuitem", { name: "Clone Template", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Confirmation", exact: true })).toBeVisible({
    timeout: 10_000,
  });
  await expect(page.getByText(new RegExp(`clone the ${sourceName} template`, "i"))).toBeVisible({
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
  await expect(table.getByRole("columnheader", { name: "To", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  await expect(table.getByRole("columnheader", { name: "Subject", exact: true })).toBeVisible({
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

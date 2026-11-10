import { expect, type Locator, type Page, type Request } from "@playwright/test";

/**
 * #724: the template edit page (`/email-management/communications/<id>/edit`) and the MailCraft
 * editor it hosts. MailCraft is a Web Component with an open shadow root, which Playwright's
 * locators pierce. Its raw-HTML view is the Code button in the editor's bar.
 */

export const SAVE_FAILED_TITLE = "Template not saved";

/** The mail template HTML policy's refusal of a non-https address, as the server words it. */
export const notHttpsRefusal = (address: string) =>
  `"${address}" is not allowed: addresses in a mail template must start with https://.`;

const SAVE_TEMPLATE_URL = /\/api\/Mail\/SaveTemplate\/?(\?.*)?$/i;

const mailcraft = (page: Page): Locator => page.locator("mailcraft-editor");

/** The edit page's own Save button (MailCraft has none of that name). */
export const editPageSaveButton = (page: Page): Locator =>
  page.getByRole("button", { name: "Save", exact: true });

/** From the template's details page, opens its edit page and waits for the editor. */
export async function openTemplateEditPage(page: Page, itemId: string) {
  await page
    .locator("header")
    .filter({ hasText: "Template preview" })
    .getByRole("button", { name: "Edit", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`/email-management/communications/${itemId}/edit$`), {
    timeout: 15_000,
  });
  await expect(codeButton(page)).toBeVisible({ timeout: 30_000 });
  await expect(editPageSaveButton(page)).toBeEnabled({ timeout: 15_000 });
}

// MailCraft labels its bar buttons with their hint text.
const codeButton = (page: Page): Locator =>
  mailcraft(page).getByRole("button", { name: "Edit the raw HTML with a live preview" });
const codeSource = (page: Page): Locator =>
  mailcraft(page).locator('textarea[data-focus-key="code-src"]');

/** Opens the Code view and returns the editor's current HTML source. */
export async function readEditorSource(page: Page): Promise<string> {
  await codeButton(page).click();
  await expect(codeSource(page)).toBeVisible({ timeout: 10_000 });
  return codeSource(page).inputValue();
}

/** Replaces the template with `html` through the Code view and applies it to the canvas. */
export async function applyEditorSource(page: Page, html: string) {
  if (!(await codeSource(page).isVisible())) {
    await codeButton(page).click();
  }
  await expect(codeSource(page)).toBeVisible({ timeout: 10_000 });
  await codeSource(page).fill(html);
  await mailcraft(page).getByRole("button", { name: "Apply to canvas" }).click();
  await expect(codeSource(page)).toBeHidden({ timeout: 10_000 });
}

/** Closes the Code view without applying anything. */
export async function closeEditorSource(page: Page) {
  await mailcraft(page).getByRole("button", { name: "Close without applying" }).click();
  await expect(codeSource(page)).toBeHidden({ timeout: 10_000 });
}

/**
 * Collects what the page reports while it runs: uncaught errors (an unhandled promise rejection
 * is one) and console errors that say "Uncaught", plus every SaveTemplate request it sends.
 */
export function watchEditPage(page: Page) {
  const uncaught: string[] = [];
  const saves: Request[] = [];
  const onPageError = (error: Error) => uncaught.push(error.message);
  const onConsole = (message: { type(): string; text(): string }) => {
    if (message.type() === "error" && message.text().includes("Uncaught")) {
      uncaught.push(message.text());
    }
  };
  const onRequest = (request: Request) => {
    if (request.method() === "POST" && SAVE_TEMPLATE_URL.test(request.url())) saves.push(request);
  };
  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("request", onRequest);
  return {
    uncaught,
    saves,
    stop: () => {
      page.off("pageerror", onPageError);
      page.off("console", onConsole);
      page.off("request", onRequest);
    },
  };
}

/** Presses the edit page's Save and returns the SaveTemplate response it causes. */
export async function saveFromEditPage(page: Page) {
  const response = page.waitForResponse(
    (r) => r.request().method() === "POST" && SAVE_TEMPLATE_URL.test(r.url()),
    { timeout: 30_000 },
  );
  await editPageSaveButton(page).click();
  return response;
}

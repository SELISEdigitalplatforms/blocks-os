import { expect, test } from "../../support/test-base";
import { openTemplateDetails } from "../../pages/email-management/copy-to-organizations";
import {
  createTemplateInConsoleFlow,
  deleteTemplate,
  getTemplate,
  type MailApi,
} from "../../pages/email-management/mail-template-subject";
import {
  SAVE_FAILED_TITLE,
  applyEditorSource,
  closeEditorSource,
  editPageSaveButton,
  notHttpsRefusal,
  openTemplateEditPage,
  readEditorSource,
  saveFromEditPage,
  urlEndsWith,
  watchEditPage,
} from "../../pages/email-management/template-save-rejection";

/**
 * #724: when the server refuses a template save, the edit page says why, stays put with the
 * user's edits, and leaves no unhandled rejection. Spec §10 on a disposable template made through
 * the console's own flow (as #726); its body is edited through MailCraft's Code view. §9 C2 and C3
 * (a malformed body, a network failure, a 5xx) can't be produced by the real server and are
 * covered by the page's unit tests. The template is deleted at the end.
 */

const HTTP_ADDRESS = "http://{{HostName}}";
const HTTPS_ADDRESS = "https://{{HostName}}";
const bodyLinkingTo = (address: string) => `<p>Open <a href="${address}">the console</a>.</p>`;

test.describe("Mail template save rejections (#724)", () => {
  test("a refused save shows the server's reason and keeps the edits; the https fix saves", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    let api: MailApi | undefined;

    try {
      await test.step("Setup: a disposable template, opened in the editor", async () => {
        api = await createTemplateInConsoleFlow(page);
        await openTemplateDetails(page, api.created.body.name);
        await openTemplateEditPage(page, api.created.itemId);
      });
      if (!api) throw new Error("The console's SaveTemplate request was not captured");
      const mail = api;
      const itemId = mail.created.itemId;
      const editUrl = urlEndsWith(`/email-management/communications/${itemId}/edit`);
      const watch = watchEditPage(page);

      await test.step("H2 / §4: saving http://{{HostName}} shows one toast with the server's TemplateBody text", async () => {
        await applyEditorSource(page, bodyLinkingTo(HTTP_ADDRESS));
        const response = await saveFromEditPage(page);
        expect(response.status(), "the server refuses the save").toBe(400);
        const refusal = notHttpsRefusal(HTTP_ADDRESS);
        expect(((await response.json()) as { errors?: unknown }).errors).toEqual({
          TemplateBody: refusal,
        });
        // Exact texts: the toaster's aria-live region repeats title and description in one string.
        await expect(page.getByText(SAVE_FAILED_TITLE, { exact: true })).toHaveCount(1, {
          timeout: 15_000,
        });
        await expect(page.getByText(SAVE_FAILED_TITLE, { exact: true })).toBeVisible();
        await expect(page.getByText(refusal, { exact: true })).toBeVisible();
      });

      await test.step("H3 / §4: the page stays on the edit URL with Save enabled and the edited HTML", async () => {
        await expect(page).toHaveURL(editUrl);
        await expect(editPageSaveButton(page)).toBeEnabled();
        const source = await readEditorSource(page);
        expect(source, "the editor keeps the refused address").toContain(`href="${HTTP_ADDRESS}"`);
        await closeEditorSource(page);
      });

      await test.step("C1 / §10: no uncaught error or 'Uncaught (in promise)' during the refused save", async () => {
        expect(watch.uncaught, "uncaught page errors").toEqual([]);
        expect(watch.saves, "§5: one SaveTemplate request for one Save").toHaveLength(1);
      });

      await test.step("H4 / H1: with https://{{HostName}} the save succeeds and opens the details page", async () => {
        const fixed = (await readEditorSource(page)).replaceAll(HTTP_ADDRESS, HTTPS_ADDRESS);
        await applyEditorSource(page, fixed);
        const response = await saveFromEditPage(page);
        expect(response.status(), "the server accepts the https address").toBe(200);
        await expect(page).toHaveURL(urlEndsWith(`/email-management/communications/${itemId}`), {
          timeout: 15_000,
        });
        expect(watch.saves, "§5: one SaveTemplate request per Save").toHaveLength(2);
        expect(watch.uncaught, "uncaught page errors").toEqual([]);
        watch.stop();
      });

      await test.step("§10: the stored body carries the fixed address", async () => {
        await page.reload();
        const stored = await getTemplate(page, mail, itemId);
        expect(stored.status).toBe(200);
        expect(stored.json.templateBody).toContain(`href="${HTTPS_ADDRESS}"`);
        expect(stored.json.templateBody).not.toContain(HTTP_ADDRESS);
      });
    } finally {
      if (api) await deleteTemplate(page, api, api.created.itemId);
    }
  });
});

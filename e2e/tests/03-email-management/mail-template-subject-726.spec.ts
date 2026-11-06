import { randomUUID } from "crypto";
import { expect, test } from "../../support/test-base";
import {
  anotherLanguageCode,
  cloneTemplate,
  createTemplateInConsoleFlow,
  deleteTemplate,
  DUPLICATE_ERROR,
  expectSaved,
  expectSubjectRequired,
  findTemplatesByName,
  getTemplate,
  saveTemplate,
  type MailApi,
} from "../../pages/email-management/mail-template-subject";

/**
 * #726: SaveTemplate and CloneTemplate reject a template whose resulting subject would be empty,
 * with 400 {"TemplateSubject": "Subject is required."}, and store nothing. The console requires a
 * subject, so the rejections are reached through the Mail API with the console's own session.
 * Covers spec §10 steps 1 (H1), 2, 3, 5, 7, 8 and H11's body save. Steps 4, 6 and 10 need a
 * legacy template without a subject (F2), which the API can no longer create; they are run by
 * hand. Every template this test creates is deleted at the end.
 */
test.describe("Mail template subject (#726)", () => {
  test("save and clone require a subject; the console's two-step create still works", async ({
    page,
  }) => {
    test.setTimeout(180_000);

    const created: string[] = [];
    let api: MailApi | undefined;
    const stamp = Date.now();

    try {
      await test.step("§10 step 1 / H1: the console's basic-information step saves name and subject", async () => {
        api = await createTemplateInConsoleFlow(page);
        created.push(api.created.itemId);
      });
      if (!api) throw new Error("The console's SaveTemplate request was not captured");
      const mail = api;
      const source = mail.created;

      await test.step("H11 / H2: the console's body save keeps the stored subject", async () => {
        // The body step (new-communication.tsx) sends only the id and the body.
        const result = await saveTemplate(page, mail, {
          itemId: source.itemId,
          templateBody: "<p>x</p>",
        });
        expectSaved(result, "body-only update");
        expect(result.json.itemId).toBe(source.itemId);

        const stored = await getTemplate(page, mail, source.itemId);
        expect(stored.status).toBe(200);
        expect(stored.json.templateSubject).toBe(source.body.templateSubject);
        expect(stored.json.templateBody).toBe("<p>x</p>");
      });

      await test.step("C3: blanking the subject on update is rejected and changes nothing", async () => {
        for (const templateSubject of ["", "   "]) {
          const result = await saveTemplate(page, mail, {
            itemId: source.itemId,
            templateSubject,
          });
          expectSubjectRequired(result, `update with subject ${JSON.stringify(templateSubject)}`);
        }
        const stored = await getTemplate(page, mail, source.itemId);
        expect(stored.json.templateSubject).toBe(source.body.templateSubject);
        expect(stored.json.templateBody).toBe("<p>x</p>");
      });

      await test.step("C1 / C2 / C12: a create without a subject is rejected and stores nothing", async () => {
        const name = `specnosub${stamp}`;
        const create = {
          itemId: "",
          name,
          language: source.body.language,
          mailConfigurationId: source.body.mailConfigurationId,
        };
        expectSubjectRequired(await saveTemplate(page, mail, create), "create with no subject");
        expectSubjectRequired(
          await saveTemplate(page, mail, { ...create, templateSubject: "   " }),
          "create with a whitespace subject",
        );
        expect(await findTemplatesByName(page, mail, name)).toEqual([]);
      });

      await test.step("C5: an update of an unknown id without a subject is rejected and stores nothing", async () => {
        const itemId = randomUUID();
        const name = `specupsert${stamp}`;
        const result = await saveTemplate(page, mail, {
          itemId,
          name,
          language: source.body.language,
        });
        expectSubjectRequired(result, "upsert with no subject");
        expect((await getTemplate(page, mail, itemId)).status).toBe(404);
        expect(await findTemplatesByName(page, mail, name)).toEqual([]);
      });

      await test.step("H7: a clone without a subject takes the source's subject", async () => {
        // blocks-os#733 (SPEC31 §6.4, H10): a clone names its language and keeps the source's
        // name; the Clone dialog sends `{ itemId, language }` and no subject.
        const language = anotherLanguageCode(mail, source.body.language);
        const result = await cloneTemplate(page, mail, { itemId: source.itemId, language });
        expectSaved(result, "clone");
        const cloneId = result.json.itemId as string;
        created.push(cloneId);

        const clone = await getTemplate(page, mail, cloneId);
        expect(clone.status).toBe(200);
        expect(clone.json.name).toBe(source.body.name);
        expect(clone.json.language).toBe(language);
        expect(clone.json.templateSubject).toBe(source.body.templateSubject);
      });

      await test.step("C8: a duplicate name and language without a subject keeps the duplicate error", async () => {
        const result = await saveTemplate(page, mail, {
          itemId: "",
          name: source.body.name,
          language: source.body.language,
          mailConfigurationId: source.body.mailConfigurationId,
        });
        expect(result.status).toBe(400);
        expect(result.json.isSuccess).toBe(false);
        expect(Object.values(result.json.errors ?? {})).toEqual([DUPLICATE_ERROR]);
      });

      await test.step("C9: a body with a disallowed link keeps the TemplateBody error", async () => {
        const name = `specbadbody${stamp}`;
        const result = await saveTemplate(page, mail, {
          itemId: "",
          name,
          language: source.body.language,
          mailConfigurationId: source.body.mailConfigurationId,
          templateBody: '<a href="https://spec-726.invalid/">x</a>',
        });
        expect(result.status).toBe(400);
        expect(result.json.isSuccess).toBe(false);
        expect(Object.keys(result.json.errors ?? {})).toEqual(["TemplateBody"]);
        expect(await findTemplatesByName(page, mail, name)).toEqual([]);
      });
    } finally {
      await test.step("Cleanup: delete the templates this test created", async () => {
        if (!api) return;
        for (const itemId of created.reverse()) {
          const result = await deleteTemplate(page, api, itemId);
          expect(result.status, `DeleteTemplate ${itemId}`).toBe(200);
        }
      });
    }
  });
});

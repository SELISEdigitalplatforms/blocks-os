import { expect, type Page, type Request, type Response } from "@playwright/test";
import { addTemplateFlow } from "./email-managements";
import { openEmailManagement } from "../../support/os-helpers";

/**
 * #726: a mail template is never stored without a subject. The console already requires one, so
 * the rejections can only be reached through the Mail API. These helpers sign in through the
 * console, take the headers and the body shape of the console's own SaveTemplate request, and
 * replay Mail API calls from the page with that session (cookies included).
 */

export const SUBJECT_REQUIRED = { TemplateSubject: "Subject is required." };
export const DUPLICATE_ERROR = "Template with the same Name and Language already exists";

const SAVE_TEMPLATE_URL = /\/api\/Mail\/SaveTemplate\/?(\?.*)?$/i;
// The project's languages, as the basic-information step loads them (useGetLanguages).
const LANGUAGES_URL = /\/api\/Language\/Gets\/?(\?.*)?$/i;

// Headers the browser sets on its own; everything else the console sent is replayed.
const BROWSER_HEADERS = new Set([
  "cookie",
  "content-length",
  "host",
  "origin",
  "referer",
  "user-agent",
  "accept-encoding",
  "connection",
]);

export type MailApiResult = {
  status: number;
  json: {
    isSuccess?: boolean;
    errors?: Record<string, string> | null;
    itemId?: string | null;
    templates?: TemplateRow[];
    totalCount?: number;
  } & Partial<TemplateRow>;
};

export type TemplateRow = {
  itemId: string;
  name?: string | null;
  language?: string | null;
  mailConfigurationId?: string | null;
  templateSubject?: string | null;
  templateBody?: string | null;
};

/** The console's step-1 SaveTemplate request body (basic-information.tsx). */
export type ConsoleStepOneBody = {
  itemId: string;
  name: string;
  language: string;
  mailConfigurationId: string;
  templateSubject: string;
  projectKey: string;
};

export type MailApi = {
  /** The Mail API base the console calls, ending in `/api/Mail`. */
  base: string;
  headers: Record<string, string>;
  /** The console's first SaveTemplate body and the id the server gave the new template. */
  created: { body: ConsoleStepOneBody; itemId: string };
  /** The language codes the project has enabled, from the console's own language request. */
  languageCodes: string[];
};

function replayableHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers())) {
    if (!BROWSER_HEADERS.has(name) && !name.startsWith("sec-") && !name.startsWith(":")) {
      headers[name] = value;
    }
  }
  headers["content-type"] = "application/json";
  return headers;
}

/**
 * §10 step 1 / H1: creates a template through the console's basic-information step and keeps the
 * SaveTemplate request it sent, which gives the Mail API base, the session headers and the
 * project key the console adds to every save.
 */
export async function createTemplateInConsoleFlow(page: Page): Promise<MailApi> {
  type Save = { request: Request; status: number; json: MailApiResult["json"] };
  const pending: Promise<Save>[] = [];
  let languageCodes: string[] = [];
  const onResponse = (response: Response) => {
    const request = response.request();
    if (request.method() === "GET" && LANGUAGES_URL.test(request.url())) {
      void response
        .json()
        .then((json: unknown) => {
          const data = (json as { data?: unknown } | null)?.data;
          const list = (Array.isArray(json) ? json : Array.isArray(data) ? data : []) as {
            languageCode?: string;
          }[];
          languageCodes = list.map((l) => l.languageCode ?? "").filter(Boolean);
        })
        .catch(() => undefined);
      return;
    }
    if (request.method() !== "POST" || !SAVE_TEMPLATE_URL.test(request.url())) return;
    pending.push(
      response
        .json()
        .catch(() => ({}))
        .then((json) => ({ request, status: response.status(), json: json as Save["json"] })),
    );
  };
  page.on("response", onResponse);
  try {
    await addTemplateFlow(page);
  } finally {
    page.off("response", onResponse);
  }

  const saves = await Promise.all(pending);
  expect(saves, "the console's Save & continue sent one SaveTemplate request").toHaveLength(1);
  const [save] = saves;
  expect(save.status, JSON.stringify(save.json?.errors ?? null)).toBe(200);
  expect(save.json.isSuccess).toBe(true);
  expect(save.json.itemId).toBeTruthy();

  const body = save.request.postDataJSON() as ConsoleStepOneBody;
  expect(body.templateSubject, "step 1 sends the subject").toBeTruthy();
  expect(body, "step 1 sends no body").not.toHaveProperty("templateBody");
  expect(body.projectKey, "the console names the project on every save").toBeTruthy();

  return {
    base: save.request.url().replace(/\/SaveTemplate\/?(\?.*)?$/i, ""),
    headers: replayableHeaders(save.request),
    created: { body, itemId: save.json.itemId as string },
    languageCodes,
  };
}

/** Calls the Mail API from the page, so the console's session cookies go along. */
export async function callMailApi(
  page: Page,
  api: MailApi,
  method: "GET" | "POST" | "DELETE",
  pathAndQuery: string,
  body?: unknown,
): Promise<MailApiResult> {
  return page.evaluate(
    async ({ url, method, headers, body }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, json };
    },
    { url: `${api.base}/${pathAndQuery}`, method, headers: api.headers, body },
  );
}

/** POST SaveTemplate with the project key the console adds to every save. */
export function saveTemplate(page: Page, api: MailApi, body: Record<string, unknown>) {
  return callMailApi(page, api, "POST", "SaveTemplate", {
    ...body,
    projectKey: api.created.body.projectKey,
  });
}

/**
 * An enabled language of the project other than `language`. Clones keep the name, so a clone
 * needs another language (SPEC31 §6.4); the test never names which one it is.
 */
export function anotherLanguageCode(api: MailApi, language: string): string {
  const other = api.languageCodes.find((code) => code !== language);
  if (!other) {
    throw new Error("The project has one enabled language; cloning needs another one.");
  }
  return other;
}

/** POST CloneTemplate: `{ itemId, language }`, as the console's Clone dialog sends it. */
export function cloneTemplate(page: Page, api: MailApi, body: Record<string, unknown>) {
  return callMailApi(page, api, "POST", "CloneTemplate", body);
}

export async function getTemplate(
  page: Page,
  api: MailApi,
  itemId: string,
): Promise<MailApiResult> {
  return callMailApi(page, api, "GET", `GetTemplate?itemId=${encodeURIComponent(itemId)}`);
}

/** GetTemplates as the console's list asks for it, narrowed by the name search. */
export async function findTemplatesByName(page: Page, api: MailApi, name: string) {
  const query = new URLSearchParams({
    pageNumber: "0",
    pageSize: "10",
    searchKey: name,
    sortProperty: "Name",
    isDescending: "false",
    language: "",
    mailConfigurationId: "",
  });
  const result = await callMailApi(page, api, "GET", `GetTemplates?${query.toString()}`);
  expect(result.status, "GetTemplates").toBe(200);
  return (result.json.templates ?? []).filter((t) => t.name === name);
}

export async function deleteTemplate(page: Page, api: MailApi, itemId: string) {
  return callMailApi(page, api, "DELETE", `DeleteTemplate?itemId=${encodeURIComponent(itemId)}`);
}

/** A 400 carrying exactly the #726 error, with no item id. */
export function expectSubjectRequired(result: MailApiResult, what: string) {
  expect(result.status, `${what}: HTTP status`).toBe(400);
  expect(result.json.isSuccess, `${what}: isSuccess`).toBe(false);
  expect(result.json.errors, `${what}: errors`).toEqual(SUBJECT_REQUIRED);
  expect(result.json.itemId ?? null, `${what}: itemId`).toBeNull();
}

/** A 200 with isSuccess and an item id. */
export function expectSaved(result: MailApiResult, what: string) {
  expect(result.status, `${what}: ${JSON.stringify(result.json?.errors ?? null)}`).toBe(200);
  expect(result.json.isSuccess, `${what}: isSuccess`).toBe(true);
  expect(result.json.itemId, `${what}: itemId`).toBeTruthy();
}

const GET_TEMPLATES_URL = /\/api\/Mail\/GetTemplates\/?(\?.*)?$/i;

/**
 * Cleanup for UI flows: deletes every template named exactly `name` through the Mail API, with
 * the session headers of the console's own GetTemplates request. Returns how many it deleted.
 */
export async function deleteTemplatesNamed(page: Page, name: string): Promise<number> {
  const listRequest = page.waitForRequest((r) => GET_TEMPLATES_URL.test(r.url()), {
    timeout: 60_000,
  });
  await openEmailManagement(page);
  const request = await listRequest;
  const organizationId = new URL(request.url()).searchParams.get("organizationId") ?? "default";
  const api: MailApi = {
    base: request.url().replace(/\/GetTemplates\/?(\?.*)?$/i, ""),
    headers: replayableHeaders(request),
    created: { body: {} as ConsoleStepOneBody, itemId: "" },
    languageCodes: [],
  };
  const query = new URLSearchParams({
    pageNumber: "0",
    pageSize: "50",
    searchKey: name,
    sortProperty: "Name",
    isDescending: "false",
    language: "",
    mailConfigurationId: "",
    organizationId,
  });
  const list = await callMailApi(page, api, "GET", `GetTemplates?${query.toString()}`);
  const ids = (list.json.templates ?? []).filter((t) => t.name === name).map((t) => t.itemId);
  for (const itemId of ids) {
    await deleteTemplate(page, api, itemId);
  }
  return ids.length;
}

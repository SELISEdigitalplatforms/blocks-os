import { expect, type Page, type Request } from "@playwright/test";
import { openEmailManagement } from "../../support/os-helpers";
import { addTemplateFlow } from "./email-managements";
import { callMailApi, consoleMailApi, type MailApi } from "./mail-template-subject";

/**
 * blocks-os#735 (SPEC33): copy a Default template to organizations. Previews run no Worker, and a
 * real copy job would write into the shared project's organizations, so every copy request the UI
 * sends is intercepted in the browser and answered here; the test checks what the UI sent (Q1: A).
 * The copies lookup and the API's refusals are real calls. Only templates this test creates are
 * used (prefix per run), and they are deleted in the spec's finally.
 */
export type CopyFixtures = {
  prefix: string;
  ready: string;
  empty: string;
  organizationTemplate: string;
  wizard: string;
  ids: { ready?: string; empty?: string; organizationTemplate?: string };
};

const COPY_URL = /\/api\/Mail\/CopyTemplateToOrganizations\/?(\?.*)?$/i;
const COPIES_URL = /\/api\/Mail\/GetTemplateOrganizationCopies\/?(\?.*)?$/i;
const STARTED = "Copying started. You'll get a notification when it's done.";

export function copyFixtureNames(stamp = Date.now()): CopyFixtures {
  const prefix = `E2ECopy${stamp}`;
  return {
    prefix,
    ready: `${prefix}ready`,
    empty: `${prefix}empty`,
    organizationTemplate: `${prefix}org`,
    wizard: `${prefix}wizard`,
    ids: {},
  };
}

export async function isMultiOrgTemplatesPage(page: Page) {
  await openEmailManagement(page);
  await expect(page.getByRole("heading", { name: "Email Templates", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByRole("tabpanel", { name: "Templates" }).getByRole("table")).toBeVisible({
    timeout: 30_000,
  });
  return (await page.locator("#email-organization-picker").count()) > 0;
}

async function saveTemplate(page: Page, api: MailApi, body: Record<string, unknown>) {
  const result = await callMailApi(page, api, "POST", "SaveTemplate", body);
  expect(result.status, JSON.stringify(result.json?.errors ?? null)).toBe(200);
  return result.json.itemId as string;
}

/** Two Default templates: one complete, one with no body yet (step 1 only). */
export async function createCopyFixtures(page: Page, names: CopyFixtures) {
  const { api } = await consoleMailApi(page);
  const sample = await callMailApi(
    page,
    api,
    "GET",
    "GetTemplates?pageNumber=0&pageSize=1&searchKey=&sortProperty=Name&isDescending=false&language=&mailConfigurationId=",
  );
  const language = sample.json.templates?.[0]?.language ?? "en-US";
  names.ids.ready = await saveTemplate(page, api, {
    itemId: "",
    name: names.ready,
    language,
    organizationId: "default",
    mailConfigurationId: "",
    templateSubject: "E2E copy subject",
    templateBody: "<p>E2E copy body.</p>",
  });
  names.ids.empty = await saveTemplate(page, api, {
    itemId: "",
    name: names.empty,
    language,
    organizationId: "default",
    mailConfigurationId: "",
    templateSubject: "E2E copy subject",
  });
  return { api, language };
}

/** C2 (real call): a template without a body is refused before anything is queued. */
export async function emptyBodyRefusedFlow(page: Page, api: MailApi, names: CopyFixtures) {
  const result = await callMailApi(page, api, "POST", "CopyTemplateToOrganizations", {
    templateId: names.ids.empty,
    allOrganizations: false,
    organizationIds: ["e2e-no-such-organization"],
    existing: "keep",
  });
  expect(result.status).toBe(400);
  expect(result.json.errors).toEqual({ TemplateId: "Finish the template before copying" });
}

async function openTemplateDetails(page: Page, name: string) {
  await openEmailManagement(page);
  const tabpanel = page.getByRole("tabpanel", { name: "Templates" });
  await tabpanel.getByPlaceholder("Search...").first().fill(name);
  const cell = tabpanel.getByRole("cell", { name, exact: true });
  await expect(cell).toBeVisible({ timeout: 15_000 });
  await cell.click();
  await expect(page).toHaveURL(/\/email-management\/communications\/[0-9a-f-]+$/, {
    timeout: 15_000,
  });
  await expect(page.getByRole("button", { name: "Send test Email", exact: true })).toBeVisible({
    timeout: 15_000,
  });
}

/** C13: with multi-org off there is no Copy button. */
export async function noCopyButtonFlow(page: Page, name: string) {
  await openTemplateDetails(page, name);
  await expect(
    page.getByRole("button", { name: "Copy to organizations", exact: true }),
  ).toHaveCount(0);
}

/**
 * H8-H11: the Copy dialog on a Default template, with the real copies lookup, Replace chosen and
 * one organization selected; the copy request is intercepted. Returns the organization it chose.
 */
export async function copyDialogFlow(page: Page, names: CopyFixtures) {
  await openTemplateDetails(page, names.ready);
  const lookup = page.waitForResponse((r) => COPIES_URL.test(r.url()), { timeout: 30_000 });
  await page.getByRole("button", { name: "Copy to organizations", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Copy to organizations" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  expect((await lookup).status(), "GetTemplateOrganizationCopies").toBe(200);

  await expect(dialog.getByRole("radio", { name: "Selected organizations" })).toBeChecked();
  await expect(dialog.getByRole("radio", { name: "Keep their copy" })).toBeChecked();
  await dialog
    .getByRole("radio", { name: "Replace it with this version, for the ones I select" })
    .check();

  const firstRow = dialog
    .getByRole("listitem")
    .filter({ has: page.getByRole("checkbox") })
    .first();
  await expect(firstRow, "the project has another organization").toBeVisible({ timeout: 15_000 });
  const rowCheckbox = firstRow.getByRole("checkbox");
  const organizationName = (
    (await rowCheckbox.getAttribute("aria-label")) ?? (await firstRow.innerText())
  )
    .split("\n")[0]
    .trim();
  await rowCheckbox.check();
  await expect(dialog.getByText(/^1 selected/)).toBeVisible();

  let sent: Request | undefined;
  await page.route(COPY_URL, async (route) => {
    sent = route.request();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isSuccess: true, itemId: "e2e-intercepted-job", errors: null }),
    });
  });
  try {
    await dialog.getByRole("button", { name: "Copy to 1 organization", exact: true }).click();
    await expect(page.getByText(STARTED, { exact: true })).toBeVisible({ timeout: 15_000 });
  } finally {
    await page.unroute(COPY_URL);
  }
  await expect(dialog).toBeHidden();
  expect(sent, "the Copy dialog sent its request").toBeTruthy();
  const body = sent!.postDataJSON() as {
    templateId: string;
    allOrganizations: boolean;
    organizationIds?: string[];
    existing: string;
  };
  expect(body.templateId).toBe(names.ids.ready);
  expect(body.allOrganizations).toBe(false);
  expect(body.existing).toBe("replace");
  expect(body.organizationIds).toHaveLength(1);
  return { organizationId: body.organizationIds![0], organizationName };
}

/**
 * C1: the API refuses to copy an organization's own template (real call,
 * refused before anything is queued). The template is the test's own, in that organization.
 */
export async function organizationTemplateFlow(
  page: Page,
  api: MailApi,
  names: CopyFixtures,
  organizationId: string,
  language: string,
) {
  names.ids.organizationTemplate = await saveTemplate(page, api, {
    itemId: "",
    name: names.organizationTemplate,
    language,
    organizationId,
    mailConfigurationId: "",
    templateSubject: "E2E copy subject",
    templateBody: "<p>E2E copy body.</p>",
  });
  const refused = await callMailApi(page, api, "POST", "CopyTemplateToOrganizations", {
    templateId: names.ids.organizationTemplate,
    allOrganizations: false,
    organizationIds: [organizationId],
    existing: "keep",
  });
  expect(refused.status).toBe(400);
  expect(refused.json.errors).toEqual({
    TemplateId: "Only Default organization templates can be copied",
  });
}

/**
 * H7, C10, Q4: New Template step 1 offers the share block; before the first save the checklist has
 * no OWN COPY markers. Step 2 names the chosen organization, "Change organizations" returns to
 * step 1 with the choice kept, and leaving before the step-2 save sends no copy request.
 */
export async function shareInNewTemplateFlow(page: Page, names: CopyFixtures) {
  const copyRequests: string[] = [];
  const watch = (request: Request) => {
    if (COPY_URL.test(request.url())) copyRequests.push(request.url());
  };
  page.on("request", watch);
  try {
    await addTemplateFlow(page, names.wizard, {
      beforeSave: async (p) => {
        const share = p.getByRole("group", { name: "Share with other organizations" });
        await expect(share).toBeVisible({ timeout: 15_000 });
        await expect(
          share.getByRole("radio", { name: "Only the Default organization" }),
        ).toBeChecked();
        await share.getByRole("radio", { name: "Copy to other organizations" }).check();
        const firstRow = share
          .getByRole("listitem")
          .filter({ has: p.getByRole("checkbox") })
          .first();
        await expect(firstRow, "the project has another organization").toBeVisible({
          timeout: 15_000,
        });
        await expect(share.getByText("OWN COPY", { exact: true })).toHaveCount(0);
        await firstRow.getByRole("checkbox").check();
      },
      afterSave: async (p) => {
        const strip = p
          .getByRole("status")
          .filter({ hasText: "When you save, this template is also copied to 1 organization" });
        await expect(strip).toBeVisible({ timeout: 15_000 });
        await strip.getByRole("button", { name: "Change organizations", exact: true }).click();
        const share = p.getByRole("group", { name: "Share with other organizations" });
        await expect(share.getByRole("radio", { name: "Copy to other organizations" })).toBeChecked(
          {
            timeout: 15_000,
          },
        );
        await expect(share.getByText(/^1 selected/)).toBeVisible();
        // Back to step 2 so the flow ends as it always does (it leaves without saving step 2).
        await p.getByRole("button", { name: "Save & continue" }).click();
        await expect(p.getByRole("heading", { name: "Template design" })).toBeVisible({
          timeout: 30_000,
        });
      },
    });
  } finally {
    page.off("request", watch);
  }
  expect(copyRequests, "no copy is requested before the step-2 save (C10)").toEqual([]);
}

/** §10 cleanup: the test's Default templates by name, and its organization template by id. */
export async function deleteCopyFixtures(page: Page, names: CopyFixtures) {
  const { api } = await consoleMailApi(page);
  const query = (searchKey: string) =>
    new URLSearchParams({
      pageNumber: "0",
      pageSize: "50",
      searchKey,
      sortProperty: "Name",
      isDescending: "false",
      language: "",
      mailConfigurationId: "",
      organizationId: "default",
    }).toString();
  const list = await callMailApi(page, api, "GET", `GetTemplates?${query(names.prefix)}`);
  const ids = (list.json.templates ?? [])
    .filter((t) => t.name?.startsWith(names.prefix))
    .map((t) => t.itemId);
  if (names.ids.organizationTemplate) ids.push(names.ids.organizationTemplate);
  for (const itemId of ids) {
    await callMailApi(page, api, "DELETE", `DeleteTemplate?itemId=${encodeURIComponent(itemId)}`);
  }
}

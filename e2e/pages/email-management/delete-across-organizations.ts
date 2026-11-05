import { expect, type Page, type Request } from "@playwright/test";
import { callMailApi, consoleMailApi, type MailApi } from "./mail-template-subject";
import { openTemplateDetails } from "./copy-to-organizations";

/**
 * blocks-os#736 (SPEC34): delete a Default template across organizations. Previews run no Worker,
 * and the real call would delete the Default template and queue a job that deletes organizations'
 * copies in the shared project, so the UI's delete-across request is intercepted and answered here
 * (D7, as #735 Q1: A). The copies lookup, the refusals and the Default-only delete are real calls on
 * templates this test creates (a Default template and its copy in one organization), deleted in the
 * spec's finally.
 */
export type DeleteFixtures = {
  prefix: string;
  name: string;
  ids: { source?: string; copy?: string };
  organizationId?: string;
  language?: string;
};

const ACROSS_URL = /\/api\/Mail\/DeleteTemplateAcrossOrganizations\/?(\?.*)?$/i;
const COPIES_URL = /\/api\/Mail\/GetTemplateOrganizationCopies\/?(\?.*)?$/i;
const ACROSS_STARTED =
  "Template deleted. Deleting organization copies runs in the background; you'll get a notification.";

export function deleteFixtureNames(stamp = Date.now()): DeleteFixtures {
  const prefix = `E2EDelete${stamp}`;
  return { prefix, name: `${prefix}source`, ids: {} };
}

async function saveTemplate(page: Page, api: MailApi, body: Record<string, unknown>) {
  const result = await callMailApi(page, api, "POST", "SaveTemplate", body);
  expect(result.status, JSON.stringify(result.json?.errors ?? null)).toBe(200);
  return result.json.itemId as string;
}

/** The test's Default template (complete, so its details page works). */
export async function createDeleteSource(page: Page, names: DeleteFixtures) {
  const { api } = await consoleMailApi(page);
  const sample = await callMailApi(
    page,
    api,
    "GET",
    "GetTemplates?pageNumber=0&pageSize=1&searchKey=&sortProperty=Name&isDescending=false&language=&mailConfigurationId=",
  );
  names.language = sample.json.templates?.[0]?.language ?? "en-US";
  names.ids.source = await saveTemplate(page, api, {
    itemId: "",
    name: names.name,
    language: names.language,
    organizationId: "default",
    mailConfigurationId: "",
    templateSubject: "E2E delete subject",
    templateBody: "<p>E2E delete body.</p>",
  });
  return api;
}

/** C3 (real call, refused before anything is deleted or queued); C1 is in createOrganizationCopy. */
export async function refusalsFlow(page: Page, api: MailApi, names: DeleteFixtures) {
  const none = await callMailApi(page, api, "POST", "DeleteTemplateAcrossOrganizations", {
    templateId: names.ids.source,
    allOrganizations: false,
    organizationIds: [],
  });
  expect(none.status).toBe(400);
  expect(none.json.errors).toEqual({ OrganizationIds: "Select at least one organization" });
  // The source must still exist: a refusal deletes nothing.
  const still = await callMailApi(page, api, "GET", `GetTemplate?itemId=${names.ids.source}`);
  expect(still.status).toBe(200);
}

async function openDeleteDialog(page: Page, names: DeleteFixtures) {
  await openTemplateDetails(page, names.name);
  await page.getByRole("button", { name: `More actions for ${names.name}`, exact: true }).click();
  await page.getByRole("menuitem", { name: "Delete", exact: true }).click();
  const dialog = page.getByRole("alertdialog", { name: `Delete ${names.name}?` });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  return dialog;
}

/**
 * Finds an organization of the project from the delete dialog's real copies lookup (the organizations
 * of the loaded page), then gives it the test's own copy and checks the org-template refusal (C1).
 */
export async function createOrganizationCopy(page: Page, api: MailApi, names: DeleteFixtures) {
  const dialog = await openDeleteDialog(page, names);
  const lookup = page.waitForRequest((r: Request) => COPIES_URL.test(r.url()), { timeout: 30_000 });
  await dialog.getByRole("radio", { name: "Also delete organizations' own copies" }).check();
  const ids = new URL((await lookup).url()).searchParams.get("organizationIds") ?? "";
  const organizationId = ids.split(",").filter(Boolean)[0];
  expect(organizationId, "the project has another organization").toBeTruthy();
  names.organizationId = organizationId;
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog).toBeHidden();

  names.ids.copy = await saveTemplate(page, api, {
    itemId: "",
    name: names.name,
    language: names.language,
    organizationId,
    mailConfigurationId: "",
    templateSubject: "E2E delete subject",
    templateBody: "<p>E2E delete body.</p>",
  });
  const refused = await callMailApi(page, api, "POST", "DeleteTemplateAcrossOrganizations", {
    templateId: names.ids.copy,
    allOrganizations: false,
    organizationIds: ["e2e-no-such-organization"],
  });
  expect(refused.status).toBe(400);
  expect(refused.json.errors).toEqual({
    TemplateId: "Only Default organization templates can be deleted across organizations",
  });
}

/**
 * H6-H8, C11: "What to delete" with the copy marked from the real lookup; Selected and All submit
 * intercepted requests (nothing is deleted or queued on the server); Cancel sends nothing.
 */
export async function deleteAcrossDialogFlow(page: Page, names: DeleteFixtures) {
  const sent: Request[] = [];
  await page.route(ACROSS_URL, async (route) => {
    sent.push(route.request());
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ isSuccess: true, itemId: "e2e-intercepted-job", errors: null }),
    });
  });
  try {
    // Cancel sends nothing (C11).
    let dialog = await openDeleteDialog(page, names);
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeFocused();
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();
    expect(sent).toHaveLength(0);

    // Selected: the organization with the test's copy, from the real copies lookup.
    dialog = await openDeleteDialog(page, names);
    const lookup = page.waitForResponse((r) => COPIES_URL.test(r.url()), { timeout: 30_000 });
    await dialog.getByRole("radio", { name: "Also delete organizations' own copies" }).check();
    expect((await lookup).status(), "GetTemplateOrganizationCopies").toBe(200);
    await expect(dialog.getByRole("radio", { name: "Selected organizations" })).toBeChecked();
    const ownRow = dialog
      .getByRole("listitem")
      .filter({ has: page.getByText("OWN COPY", { exact: true }) })
      .first();
    await expect(ownRow, "the test's copy is marked").toBeVisible({ timeout: 15_000 });
    await expect(ownRow.getByText("Keeps their copy", { exact: true })).toBeVisible();
    await ownRow.getByRole("checkbox").check();
    await expect(ownRow.getByText("Deletes their copy", { exact: true })).toBeVisible();
    await expect(
      dialog.getByText(
        /Deleting copies runs in the background; you get a notification when it's done\.$/,
      ),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(ACROSS_STARTED, { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(sent).toHaveLength(1);
    expect(sent[0].postDataJSON()).toEqual({
      templateId: names.ids.source,
      allOrganizations: false,
      organizationIds: [names.organizationId],
    });

    // All organizations: no ids in the request.
    dialog = await openDeleteDialog(page, names);
    await dialog.getByRole("radio", { name: "Also delete organizations' own copies" }).check();
    await dialog.getByRole("radio", { name: "All organizations" }).check();
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByText(ACROSS_STARTED, { exact: true })).toBeVisible({ timeout: 15_000 });
    expect(sent).toHaveLength(2);
    expect(sent[1].postDataJSON()).toEqual({
      templateId: names.ids.source,
      allOrganizations: true,
    });
  } finally {
    await page.unroute(ACROSS_URL);
  }
}

/** H1 (real call): "Only the Default organization's template" deletes it and leaves the copy. */
export async function defaultOnlyDeleteFlow(page: Page, api: MailApi, names: DeleteFixtures) {
  const dialog = await openDeleteDialog(page, names);
  await expect(
    dialog.getByRole("radio", { name: "Only the Default organization's template" }),
  ).toBeChecked();
  await dialog.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByText("Deleted template successfully", { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  expect(
    (await callMailApi(page, api, "GET", `GetTemplate?itemId=${names.ids.source}`)).status,
  ).toBe(404);
  expect((await callMailApi(page, api, "GET", `GetTemplate?itemId=${names.ids.copy}`)).status).toBe(
    200,
  );
}

/** §10 cleanup: the test's Default template and its organization copy, by id. */
export async function deleteDeleteFixtures(page: Page, names: DeleteFixtures) {
  const { api } = await consoleMailApi(page);
  const failed: string[] = [];
  for (const itemId of [names.ids.source, names.ids.copy]) {
    if (!itemId) continue;
    const exists = await callMailApi(page, api, "GET", `GetTemplate?itemId=${itemId}`);
    if (exists.status !== 200) continue;
    const result = await callMailApi(page, api, "DELETE", `DeleteTemplate?itemId=${itemId}`);
    if (result.status !== 200) failed.push(itemId);
  }
  // Soft, so a cleanup problem never hides the failure that brought the test here.
  expect.soft(failed, "the test's templates were deleted").toEqual([]);
}

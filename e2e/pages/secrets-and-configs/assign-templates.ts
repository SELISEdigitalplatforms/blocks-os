import { expect, type Page, type Request } from "@playwright/test";
import {
  callMailApi,
  replayableHeaders,
  type ConsoleStepOneBody,
  type MailApi,
} from "../email-management/mail-template-subject";
import {
  chooseFromConfigMenu,
  configMenuButton,
  dialogSelect,
  fillAndSaveEmailConfigFlow,
  isMultiOrgPage,
  keepOrganizationDefaultUnticked,
  navigateToEmailFlow,
  openAddEmailConfigDialogFlow,
} from "./email";

/**
 * blocks-os#734 (SPEC32) §10: assign templates to a configuration in bulk. The fixtures (two
 * outbound configurations, an inbound one and three templates) are created by the test with one
 * name prefix and deleted at the end. The shared project has multi-org on (#733 Q2), so they live
 * in its Default organization; every list step searches for the prefix first, so "Select all"
 * (allMatching) only ever touches the test's own templates (#734 Q1: A).
 */
export type AssignFixtures = {
  prefix: string;
  configA: string;
  configB: string;
  inbound: string;
  templates: string[];
};

const GETS_URL = /\/api\/Mail\/Gets\/?(\?.*)?$/i;

export function assignFixtureNames(stamp = Date.now()): AssignFixtures {
  const prefix = `E2EAssign${stamp}`;
  return {
    prefix,
    configA: `${prefix} A`,
    configB: `${prefix} B`,
    inbound: `${prefix} Inbox`,
    // Four, so two are left for Select all in step 3 and its texts are the plural ones.
    templates: ["a", "b", "c", "d"].map((suffix) => `${prefix}${suffix}`),
  };
}

/** Opens the Email page and keeps the console's own Mail/Gets request for API calls. */
export async function openEmailPageWithApi(page: Page): Promise<MailApi> {
  const gets = page.waitForRequest((r: Request) => GETS_URL.test(r.url()), { timeout: 60_000 });
  await navigateToEmailFlow(page);
  const request = await gets;
  return {
    base: request.url().replace(/\/Gets\/?(\?.*)?$/i, ""),
    headers: replayableHeaders(request),
    created: { body: {} as ConsoleStepOneBody, itemId: "" },
    languageCodes: [],
  };
}

type ConfigRow = { itemId: string; name?: string; configurationName?: string };

async function configurationIdNamed(page: Page, api: MailApi, name: string) {
  const result = await callMailApi(page, api, "GET", "Gets?pageNumber=1&pageSize=100");
  const json = result.json as unknown;
  const data = (json as { data?: unknown } | null)?.data;
  const list = (Array.isArray(json) ? json : Array.isArray(data) ? data : []) as ConfigRow[];
  return list.find((c) => (c.name ?? c.configurationName) === name)?.itemId;
}

async function templatesNamedWithPrefix(page: Page, api: MailApi, prefix: string) {
  const query = new URLSearchParams({
    pageNumber: "0",
    pageSize: "50",
    searchKey: prefix,
    sortProperty: "Name",
    isDescending: "false",
    language: "",
    mailConfigurationId: "",
    organizationId: "default",
  });
  const result = await callMailApi(page, api, "GET", `GetTemplates?${query.toString()}`);
  return (result.json.templates ?? []).filter((t) => t.name?.startsWith(prefix));
}

/** §10 fixtures: E2E-A and E2E-B (outbound) and the templates on E2E-A. */
export async function createAssignFixtures(page: Page, api: MailApi, names: AssignFixtures) {
  for (const configName of [names.configA, names.configB]) {
    await openAddEmailConfigDialogFlow(page);
    await fillAndSaveEmailConfigFlow(page, configName);
    await expect(configMenuButton(page, configName)).toBeVisible({ timeout: 15_000 });
  }
  const configAId = await configurationIdNamed(page, api, names.configA);
  expect(configAId, `${names.configA} was saved`).toBeTruthy();

  // Any language the project's templates use; the test never names it.
  const sample = await callMailApi(
    page,
    api,
    "GET",
    "GetTemplates?pageNumber=0&pageSize=1&searchKey=&sortProperty=Name&isDescending=false&language=&mailConfigurationId=",
  );
  const language = sample.json.templates?.[0]?.language ?? "en-US";
  for (const name of names.templates) {
    const result = await callMailApi(page, api, "POST", "SaveTemplate", {
      itemId: "",
      name,
      language,
      organizationId: "default",
      mailConfigurationId: configAId,
      templateSubject: "E2E assign subject",
      templateBody: "<p>E2E assign body.</p>",
    });
    expect(result.status, JSON.stringify(result.json?.errors ?? null)).toBe(200);
  }
}

/** Opens a card's Assign templates dialog and narrows it to the test's templates (Q1: A). */
export async function openAssignDialog(page: Page, names: AssignFixtures, configName: string) {
  await chooseFromConfigMenu(page, configName, "Assign templates");
  const dialog = page.getByRole("dialog", { name: "Assign templates" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(
    dialog.getByText(`Pick the templates that should send through ${configName}.`, {
      exact: false,
    }),
  ).toBeVisible();
  await dialog.getByRole("searchbox", { name: "Search templates" }).fill(names.prefix);
  // The search applies after a short pause: wait until the list shows only the test's templates.
  const count = names.templates.length;
  await expect(dialog.getByText(`1–${count} of ${count}`, { exact: true })).toBeVisible({
    timeout: 15_000,
  });
  for (const name of names.templates) {
    await expect(dialog.getByRole("checkbox", { name: new RegExp(`^${name} · `) })).toBeVisible({
      timeout: 15_000,
    });
  }
  return dialog;
}

function rowCheckbox(page: Page, name: string) {
  return page
    .getByRole("dialog", { name: "Assign templates" })
    .getByRole("checkbox", { name: new RegExp(`^${name} · `) });
}

/** §10 step 1 (H6, H7, H10): tick two of the three, see what happens, assign. */
export async function assignTwoTemplatesFlow(page: Page, names: AssignFixtures) {
  const dialog = await openAssignDialog(page, names, names.configB);
  for (const header of ["Name", "Language", "Current configuration", "What happens"]) {
    await expect(dialog.getByRole("columnheader", { name: header, exact: true })).toBeVisible();
  }
  const [first, second] = names.templates;
  await rowCheckbox(page, first).check();
  await rowCheckbox(page, second).check();
  await expect(dialog.getByText(`Switches to ${names.configB}`, { exact: true })).toHaveCount(2);
  await expect(dialog.getByText("No change", { exact: true })).toHaveCount(
    names.templates.length - 2,
  );
  await dialog.getByRole("button", { name: "Assign 2 templates", exact: true }).click();
  await expect(page.getByText(`2 templates now use ${names.configB}`, { exact: true })).toBeVisible(
    {
      timeout: 15_000,
    },
  );
  await expect(dialog).toBeHidden();
}

/** §10 step 2 (H4): the two assigned rows are disabled and say so. */
export async function alreadyAssignedRowsFlow(page: Page, names: AssignFixtures) {
  const dialog = await openAssignDialog(page, names, names.configB);
  const [first, second, ...rest] = names.templates;
  await expect(rowCheckbox(page, first)).toBeDisabled();
  await expect(rowCheckbox(page, second)).toBeDisabled();
  for (const name of rest) {
    await expect(rowCheckbox(page, name)).toBeEnabled();
  }
  await expect(dialog.getByText(`Already uses ${names.configB}`, { exact: true })).toHaveCount(2);
  return dialog;
}

/**
 * §10 step 3 (H8, H9), on the dialog step 2 left open and filtered by the test's prefix: header
 * checkbox, the page bar, Select all, then one allMatching request carrying that search.
 */
export async function selectAllMatchingFlow(page: Page, names: AssignFixtures) {
  const dialog = page.getByRole("dialog", { name: "Assign templates" });
  const left = names.templates.length - 2;
  // The Default organization's card: its texts name the organization only with multi-org on.
  const where = (await isMultiOrgPage(page)) ? " in the Default organization" : "";
  await dialog.getByRole("checkbox", { name: "Select all templates on this page" }).check();
  await expect(
    dialog.getByText(`All ${left} on this page are selected.`, { exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: `Select all ${left} templates${where}`, exact: true })
    .click();
  await expect(
    dialog.getByText(`All ${left} templates${where} are selected, on every page.`, {
      exact: true,
    }),
  ).toBeVisible();
  const assign = page.waitForRequest(
    (r) => /\/api\/Mail\/AssignTemplates\/?$/i.test(r.url()) && r.method() === "POST",
  );
  await dialog.getByRole("button", { name: `Assign ${left} templates`, exact: true }).click();
  const body = (await assign).postDataJSON() as {
    allMatching?: boolean;
    searchKey?: string;
    templateIds?: string[];
  };
  expect(body.allMatching, "Select all submits allMatching").toBe(true);
  expect(body.searchKey, "allMatching carries the test's own search (Q1: A)").toBe(names.prefix);
  await expect(
    page.getByText(`${left} templates now use ${names.configB}`, { exact: true }),
  ).toBeVisible({
    timeout: 15_000,
  });
}

/** §10 step 4 (C1): an inbound configuration's menu has no Assign templates. */
export async function inboundHasNoAssignFlow(page: Page, names: AssignFixtures) {
  await openAddEmailConfigDialogFlow(page);
  await dialogSelect(page, 0).click();
  await page.getByRole("option", { name: "Inbound" }).click();
  await page.getByPlaceholder("Enter name").fill(names.inbound);
  await page.getByPlaceholder("Enter Server Name").fill("imap.example.com");
  await page.getByPlaceholder("Enter port").fill("993");
  await page.getByPlaceholder("Enter username").fill("e2e-inbox-user");
  await page.getByPlaceholder("Enter password").fill("NotASecret123");
  await keepOrganizationDefaultUnticked(page);
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeEnabled({ timeout: 10_000 });
  await save.click();
  const menuButton = configMenuButton(page, names.inbound);
  await expect(menuButton).toBeVisible({ timeout: 15_000 });
  await menuButton.click();
  await expect(page.getByRole("menuitem", { name: "Edit", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Assign templates", exact: true })).toHaveCount(
    0,
  );
  await page.keyboard.press("Escape");
}

/** §10 cleanup: the test's templates first, then its configurations, through the Mail API. */
export async function deleteAssignFixtures(page: Page, api: MailApi, names: AssignFixtures) {
  for (const template of await templatesNamedWithPrefix(page, api, names.prefix)) {
    await callMailApi(
      page,
      api,
      "DELETE",
      `DeleteTemplate?itemId=${encodeURIComponent(template.itemId)}`,
    );
  }
  for (const configName of [names.configA, names.configB, names.inbound]) {
    const id = await configurationIdNamed(page, api, configName);
    if (id) {
      await callMailApi(page, api, "DELETE", `Delete?configurationId=${encodeURIComponent(id)}`);
    }
  }
}

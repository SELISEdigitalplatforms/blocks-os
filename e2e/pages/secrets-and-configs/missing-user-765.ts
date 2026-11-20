import { randomUUID } from "crypto";
import { type Locator, type Page, type Request, type Response, expect } from "@playwright/test";
import { openSecretManagement } from "../../support/os-helpers";

// os#765: a secret's access list holds a user id that IAM has no user for.
//
// IAM on dev has no endpoint to delete a user (users/create, users/{id}, activate and deactivate
// only), so §10's "create a user, then delete it" cannot be done. A well-formed id that IAM never
// issued leaves IAM in the same state as a deleted user (no record for that id), and the stored
// access list is the same. The UI picker only offers existing users, so the id is put into the
// app's own create request (`POST /api/secrets/set`) as it leaves the browser.

export const SECRET_SET_URL = /\/api\/secrets\/set\/?(\?.*)?$/;
export const SECRET_ACCESS_URL = /\/api\/secrets\/access\/?(\?.*)?$/;

export function newMissingUserId(): string {
  return randomUUID();
}

/** True for the IAM user-by-id lookup of `userId` (path ends in `/iam/users/<id>`). */
export function isUserByIdUrl(url: string, userId: string): boolean {
  return new URL(url).pathname.replace(/\/$/, "").endsWith(`/iam/users/${userId}`);
}

/** Console and page errors that the old normalizer crash produced, plus any Rollbar report of it. */
export class ErrorWatch {
  readonly consoleErrors: string[] = [];
  readonly pageErrors: string[] = [];
  readonly rollbarBodies: string[] = [];

  constructor(page: Page) {
    page.on("console", (message) => {
      if (message.type() === "error") this.consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => this.pageErrors.push(`${error.name}: ${error.message}`));
    page.on("request", (request: Request) => {
      if (/rollbar/i.test(request.url())) this.rollbarBodies.push(request.postData() ?? "");
    });
  }

  /** Messages that name the crash: the normalizer's TypeError or its `organizationIds` read. */
  crashMessages(): string[] {
    const crash = /organizationIds|TypeError/;
    return [...this.consoleErrors, ...this.pageErrors].filter((text) => crash.test(text));
  }

  rollbarReportsFor(userId: string): string[] {
    return this.rollbarBodies.filter(
      (body) => body.includes(userId) || /organizationIds|user-by-id/.test(body),
    );
  }
}

/**
 * Creates an Application secret through the Create dialog. The create request gets the missing
 * user's id as its only access entry; everything else is what the dialog sent.
 */
export async function createSecretWithMissingUser(
  page: Page,
  secretName: string,
  missingUserId: string,
): Promise<string> {
  await openSecretManagement(page, "secret", "Secret");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Create secret" })).toBeVisible();
  await expect(page.getByText("Who may read this secret's value.")).toBeVisible();

  let sentType: unknown;
  await page.route(SECRET_SET_URL, async (route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.continue();
    const body = JSON.parse(request.postData() ?? "{}");
    sentType = body.type;
    body.access = { userIds: [missingUserId], roles: [] };
    await route.continue({ postData: JSON.stringify(body) });
  });

  await page.getByPlaceholder("payment-gateway-key").fill(secretName);
  await page.getByPlaceholder("What this secret is for").fill("os#765 missing user in the access list.");
  await page.getByPlaceholder("Paste the secret value").fill("os-765-missing-user-value");
  const created = page.waitForResponse(
    (response) => SECRET_SET_URL.test(response.url()) && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save" }).click();
  const response = await created;
  await page.unroute(SECRET_SET_URL);

  expect(response.ok(), `create secret answered ${response.status()}`).toBeTruthy();
  await expect(page.getByRole("heading", { name: "Create secret" })).toBeHidden({ timeout: 15_000 });
  return String(sentType);
}

export async function reloadSecretList(page: Page) {
  await openSecretManagement(page, "secret", "Secret");
}

/** Types into the list search and waits for the server's answer to that search. */
async function searchSecrets(page: Page, term: string) {
  const searchInput = page.getByPlaceholder("Search by name or ID").first();
  const answered = page.waitForResponse(
    (response) =>
      /\/api\/secrets\/gets/.test(response.url()) &&
      new URL(response.url()).searchParams.get("search") === term,
    { timeout: 20_000 },
  );
  await searchInput.fill(term);
  await answered;
}

export async function findSecretRow(page: Page, secretName: string): Promise<Locator> {
  // The list re-renders when the debounced search answers; acting before that detaches menus.
  await searchSecrets(page, secretName);
  const row = page.getByRole("row").filter({ hasText: secretName });
  await expect(row).toBeVisible({ timeout: 15_000 });
  return row;
}

/** The "Allowed users" block of the expanded row: its label plus its chips. */
export function allowedUsersBlock(page: Page): Locator {
  return page.getByText("Allowed users", { exact: true }).locator("xpath=..");
}

/**
 * Expands the row and waits for the access list's user lookup. Returns that lookup's response
 * so the caller can check what IAM answered (spec A1: 200 with empty `data`).
 */
export async function expandAndAwaitUserLookup(
  page: Page,
  row: Locator,
  missingUserId: string,
): Promise<Response> {
  const lookup = page.waitForResponse(
    (response) =>
      isUserByIdUrl(response.url(), missingUserId) && response.request().method() === "GET",
    { timeout: 20_000 },
  );
  await row.click();
  await expect(allowedUsersBlock(page)).toBeVisible({ timeout: 15_000 });
  return lookup;
}

export async function openEditDialog(page: Page, secretName: string): Promise<Locator> {
  await page.getByRole("button", { name: `Actions for ${secretName}` }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: "Edit secret" })).toBeVisible();
  return dialog;
}

export const SECRET_NAME_PREFIX = "os-765-missing-user-";

async function archiveOne(page: Page, secretName: string) {
  const actions = page.getByRole("button", { name: `Actions for ${secretName}` });
  await actions.click();
  const archive = page.getByRole("menuitem", { name: "Archive" });
  await expect(archive).toBeVisible();
  await archive.click();
  const heading = page.getByRole("heading", { name: `Archive ${secretName}?` });
  await expect(heading).toBeVisible();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(heading).toBeHidden({ timeout: 15_000 });
}

/**
 * Archives every active secret this spec created (its name prefix), including one an earlier
 * run left behind. Waits for the search answer first: a menu opened before the debounced search
 * re-renders the list is detached and the click never lands (seen on dev-os, 2026-11-20).
 */
export async function archiveSpecSecrets(page: Page) {
  await reloadSecretList(page);
  await searchSecrets(page, SECRET_NAME_PREFIX);
  const rows = page.getByRole("row").filter({ hasText: SECRET_NAME_PREFIX });
  await expect(rows.first()).toBeVisible({ timeout: 15_000 });
  for (let left = await rows.count(); left > 0; left -= 1) {
    const name = (await rows.first().getByText(SECRET_NAME_PREFIX).first().innerText()).trim();
    await archiveOne(page, name);
    await expect(page.getByRole("row").filter({ hasText: name })).toBeHidden({ timeout: 10_000 });
  }
}

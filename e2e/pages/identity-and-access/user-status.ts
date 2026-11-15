import {
  expect,
  type Locator,
  type Page,
  type Request,
  type Route,
  type TestInfo,
} from "@playwright/test";
import { e2eTestEmailDomain } from "../../support/env";
import { buildProjectRouteUrl, gotoE2e } from "../../support/navigation";
import { openIam } from "../../support/os-helpers";
import { readOsProject } from "../../support/os-project";
import {
  navigateToUsersFlow,
  openInviteUserDialogFlow,
  sendInviteFlow,
  waitForUsersListSettledFlow,
} from "./users";

// Page object for the user detail ⋮ menu (os#760): deactivate / reactivate a user account.
//
// SAFETY: every status change in this file targets a dedicated dummy user that the spec itself
// invites (fixed synthetic addresses on the test e-mail domain). assertDummyTarget() runs before
// any deactivation and refuses the logged-in account or any address outside that pattern.

export const DUMMY_LOCAL_PART_PREFIX = "e2e-status-";

/** U1: dedicated dummy user, kept Active between tests. */
export function u1Email(): string {
  return `${DUMMY_LOCAL_PART_PREFIX}u1@${e2eTestEmailDomain()}`;
}

/** U2: dedicated dummy invitee that never activates (PendingVerification). */
export function u2Email(): string {
  return `${DUMMY_LOCAL_PART_PREFIX}u2@${e2eTestEmailDomain()}`;
}

export type AccountState = "Active" | "PendingVerification" | "Suspended" | "Deactivated";

export type DummyUser = { id: string; email: string };

export type LoadedUser = {
  id: string;
  email: string;
  accountState: AccountState | undefined;
  active: boolean | undefined;
};

const USER_ID_IN_URL = /\/iam\/user-detail\/([^/?#]+)/;

export const STATUS_TEXT = {
  deactivateSuccess: "User has been deactivated successfully.",
  activateSuccess: "User has been activated successfully.",
  forbidden: "You don't have permission to change this user's status.",
  somethingWentWrong: "Something went wrong",
  reasonTooShort: "Enter a reason of at least 3 characters.",
  deactivateTitle: "Deactivate account?",
  deactivateDescription:
    "This user will be signed out of every session immediately and can't sign in until the account is activated again.",
  activateTitle: "Activate account?",
  activateDescription:
    "This user will be able to sign in again. Your reason is saved in their activity history.",
  reasonPlaceholder: "Why is this account being activated?",
} as const;

// ─── IAM request recorder (P1–P3) ────────────────────────────────────────────

export type IamCall = {
  method: string;
  url: string;
  /** Path below the IAM base, e.g. "/api/iam/users/deactivate". */
  path: string;
  body: unknown;
  seq: number;
};

/**
 * Records every request a page sends and answers questions about the ones that go to
 * BLOCKS_IAM_BASE_URL. The IAM base is not known up front (it is a runtime env of the app), so it
 * is learnt from the first user-by-id read (`GET {IAM}/api/iam/users/{id}`).
 */
export class IamTraffic {
  private readonly requests: { request: Request; seq: number }[] = [];
  private readonly inFlight = new Set<Request>();
  private lastActivity = Date.now();
  private seq = 0;
  iamBase: string | null = null;

  constructor(page: Page) {
    page.on("request", (request) => {
      this.requests.push({ request, seq: this.seq++ });
      this.inFlight.add(request);
      if (this.isIam(request.url())) this.lastActivity = Date.now();
      if (!this.iamBase) {
        const match = /^(.*)\/api\/iam\/users\/[0-9a-f-]{8,}$/i.exec(request.url().split("?")[0]);
        if (match && request.method() === "GET") this.iamBase = match[1];
      }
    });
    const settle = (request: Request) => {
      this.inFlight.delete(request);
      if (this.isIam(request.url())) this.lastActivity = Date.now();
    };
    page.on("requestfinished", settle);
    page.on("requestfailed", settle);
  }

  private isIam(url: string): boolean {
    return !!this.iamBase && url.startsWith(`${this.iamBase}/api/`);
  }

  /** A position in the request log; pass it to since(). */
  mark(): number {
    return this.seq;
  }

  /** IAM requests (CORS preflights excluded) sent at or after `mark`. */
  since(mark: number): IamCall[] {
    const base = this.iamBase;
    if (!base) throw new Error("IAM base URL not learnt yet: no user-by-id read was seen.");
    return this.requests
      .filter(({ request, seq }) => seq >= mark && this.isIam(request.url()))
      .filter(({ request }) => request.method() !== "OPTIONS")
      .map(({ request, seq }) => {
        let body: unknown = null;
        try {
          body = request.postDataJSON();
        } catch {
          body = request.postData();
        }
        return {
          method: request.method(),
          url: request.url(),
          path: request.url().slice(base.length).split("?")[0],
          body,
          seq,
        };
      });
  }

  /** Waits until no IAM request is in flight and none has started for `quietMs`. */
  async waitForQuiet(quietMs = 1_500) {
    await expect
      .poll(
        () => {
          const busy = [...this.inFlight].some((request) => this.isIam(request.url()));
          return !busy && Date.now() - this.lastActivity >= quietMs;
        },
        { timeout: 30_000, intervals: [250] },
      )
      .toBe(true);
  }
}

/** Short description of IAM calls for assertion messages (paths only, no headers or bodies). */
export function describeCalls(calls: IamCall[]): string {
  return calls.map((call) => `${call.method} ${call.path}`).join(", ") || "(none)";
}

// ─── Locators ────────────────────────────────────────────────────────────────

/** The visible ⋮ trigger. The shell mounts the header slot twice (mobile + desktop copy). */
export function moreActionsTrigger(page: Page): Locator {
  return page.getByRole("button", { name: "More actions", exact: true }).filter({ visible: true });
}

export function actionMenu(page: Page): Locator {
  return page.getByRole("menu");
}

export function deactivateDialog(page: Page): Locator {
  return page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: STATUS_TEXT.deactivateTitle }) });
}

export function activateDialog(page: Page): Locator {
  return page
    .getByRole("dialog")
    .filter({ has: page.getByRole("heading", { name: STATUS_TEXT.activateTitle }) });
}

export function notifications(page: Page): Locator {
  return page.getByRole("region", { name: /Notifications/i });
}

/** The STATUS value in the Account details card of the user detail sidebar. */
export function statusValue(page: Page): Locator {
  return page
    .getByRole("heading", { name: "Account details" })
    .locator("..")
    .getByText(/^Status$/i)
    .locator("xpath=following-sibling::div[1]");
}

// ─── Navigation ──────────────────────────────────────────────────────────────

function userDetailUrl(userId: string): string {
  const fixture = readOsProject();
  if (!fixture?.itemId) throw new Error("Missing fixtures/os-project.json — run os-setup first.");
  return buildProjectRouteUrl(fixture.itemId, `iam/user-detail/${userId}`);
}

function isUserReadOf(userId: string) {
  return (url: string, method: string) =>
    method === "GET" && url.split("?")[0].endsWith(`/api/iam/users/${userId}`);
}

/**
 * Opens a user's detail page by URL and waits for its user-by-id read and the enabled ⋮ trigger.
 * Returns what IAM answered for that user (id, e-mail, account state).
 */
export async function openUserDetail(page: Page, userId: string): Promise<LoadedUser> {
  const isRead = isUserReadOf(userId);
  const readPromise = page.waitForResponse(
    (response) => isRead(response.url(), response.request().method()),
    { timeout: 60_000 },
  );
  await gotoE2e(page, userDetailUrl(userId));
  const response = await readPromise;
  expect(response.status(), "user-by-id read must succeed").toBe(200);
  const loaded = toLoadedUser(userId, await response.json());
  await expect(moreActionsTrigger(page)).toBeEnabled({ timeout: 30_000 });
  await expect(statusValue(page)).toHaveText(/^(Active|Inactive)/, { timeout: 30_000 });
  return loaded;
}

/** Reloads the current user detail page and returns the fresh read. */
export async function reloadUserDetail(page: Page, userId: string): Promise<LoadedUser> {
  const isRead = isUserReadOf(userId);
  const readPromise = page.waitForResponse(
    (response) => isRead(response.url(), response.request().method()),
    { timeout: 60_000 },
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  const loaded = toLoadedUser(userId, await (await readPromise).json());
  await expect(moreActionsTrigger(page)).toBeEnabled({ timeout: 30_000 });
  return loaded;
}

function toLoadedUser(userId: string, body: unknown): LoadedUser {
  const data = ((body as { data?: unknown })?.data ?? body) as {
    email?: string;
    accountState?: AccountState;
    active?: boolean;
  };
  return {
    id: userId,
    email: (data.email ?? "").toLowerCase(),
    accountState: data.accountState,
    active: data.active,
  };
}

/**
 * Refuses any target that is not the expected dummy user, and the logged-in account in every case.
 * The comparison result is asserted, never the logged-in address itself, so it is not printed.
 */
export function assertDummyTarget(loaded: LoadedUser, expectedEmail: string) {
  const email = loaded.email.toLowerCase();
  expect(email, "status actions may only target the spec's dummy user").toBe(
    expectedEmail.toLowerCase(),
  );
  expect(email.startsWith(DUMMY_LOCAL_PART_PREFIX), "target must be a dummy address").toBe(true);
  const operator = (process.env.E2E_USERNAME ?? "").trim().toLowerCase();
  expect(operator.length > 0, "E2E_USERNAME must be known to rule it out").toBe(true);
  expect(email === operator, "target must not be the logged-in test account").toBe(false);
}

// ─── Dummy user setup ────────────────────────────────────────────────────────

function userRow(page: Page, email: string): Locator {
  return page.locator('[role="button"]').filter({ hasText: email });
}

/** Searches the Users list by e-mail; opens the user and returns its id, or null when absent. */
export async function findUserIdByEmail(page: Page, email: string): Promise<string | null> {
  await openIam(page, `users?selected-filter=email&email=${encodeURIComponent(email)}`, "Users");
  await waitForUsersListSettledFlow(page);
  const row = userRow(page, email);
  if ((await row.count()) === 0) return null;
  await row.first().click();
  await expect(page).toHaveURL(USER_ID_IN_URL, { timeout: 15_000 });
  return USER_ID_IN_URL.exec(page.url())?.[1] ?? null;
}

/** Invites `email` into the default organization and returns the new user's id. */
export async function inviteDummyUser(page: Page, email: string): Promise<string> {
  await navigateToUsersFlow(page);
  await openInviteUserDialogFlow(page);
  const createPromise = page.waitForResponse(
    (response) =>
      /\/api\/iam\/users\/create\/?$/i.test(response.url()) &&
      response.request().method() === "POST",
    { timeout: 30_000 },
  );
  await sendInviteFlow(page, email);
  const created = (await (await createPromise).json()) as { itemId?: string | null };
  if (created.itemId) return created.itemId;
  // The create answer carries no id: find the invitee in the list instead.
  let id: string | null = null;
  await expect
    .poll(
      async () => {
        id = await findUserIdByEmail(page, email);
        return id;
      },
      { timeout: 90_000, intervals: [5_000] },
    )
    .not.toBeNull();
  return id as unknown as string;
}

export async function findOrInviteDummyUser(page: Page, email: string): Promise<DummyUser> {
  const existing = await findUserIdByEmail(page, email);
  const id = existing ?? (await inviteDummyUser(page, email));
  return { id, email };
}

/**
 * Test setup only: turns the dummy invitee U1 into an Active, verified account. The UI offers no
 * activation for PendingVerification (by design, D2), so for this one setup step the user-by-id
 * read is answered as "Deactivated" to reach the real Activate dialog; the activate request itself
 * goes to IAM unchanged (IAM's admin activate also verifies an invitee), and the re-read after it
 * is real again.
 */
export async function promotePendingDummyToActive(page: Page, user: DummyUser, reason: string) {
  const isRead = isUserReadOf(user.id);
  const readMatcher = (url: URL) => isRead(url.toString(), "GET");
  const asDeactivated = async (route: Route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const response = await route.fetch();
    const body = (await response.json()) as { data?: Record<string, unknown> };
    const record = (body.data ?? body) as Record<string, unknown>;
    record.accountState = "Deactivated";
    record.active = false;
    record.isVerified = true;
    await route.fulfill({ response, json: body });
  };
  await page.route(readMatcher, asDeactivated);
  const loaded = await openUserDetail(page, user.id);
  assertDummyTarget(loaded, user.email);
  await chooseMenuItem(page, "Activate account");
  const dialog = activateDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Reason" }).fill(reason);
  await page.unroute(readMatcher, asDeactivated);
  const activatePromise = page.waitForResponse(
    (response) =>
      /\/api\/iam\/users\/activate\/?$/.test(response.url()) &&
      response.request().method() === "POST",
  );
  await dialog.getByRole("button", { name: "Activate account", exact: true }).click();
  const activated = await activatePromise;
  expect(activated.status(), "admin activate of the dummy user").toBe(200);
  await expect(dialog).toBeHidden();
}

// ─── Menu and dialog actions ─────────────────────────────────────────────────

export async function openActionMenu(page: Page): Promise<Locator> {
  await moreActionsTrigger(page).click();
  const menu = actionMenu(page);
  await expect(menu).toBeVisible();
  return menu;
}

export async function closeActionMenu(page: Page) {
  await page.keyboard.press("Escape");
  await expect(actionMenu(page)).toBeHidden();
}

/** Accessible roles of the open menu's direct children, in order (menuitem / separator). */
export async function menuStructure(menu: Locator): Promise<string[]> {
  return menu.evaluate((element) =>
    Array.from(element.querySelectorAll('[role="menuitem"], [role="separator"]')).map(
      (child) => `${child.getAttribute("role")}:${(child.textContent ?? "").trim()}`,
    ),
  );
}

export async function expectMenuItems(page: Page, expected: string[]) {
  const menu = await openActionMenu(page);
  await expect(menu.getByRole("menuitem")).toHaveText(expected);
  await closeActionMenu(page);
}

export async function chooseMenuItem(page: Page, item: string) {
  const menu = await openActionMenu(page);
  await menu.getByRole("menuitem", { name: item, exact: true }).click();
  await expect(menu).toBeHidden();
}

/** Deactivates the dummy user on the open detail page through the ⋮ menu and confirms. */
export async function deactivateDummy(page: Page, target: DummyUser, loaded: LoadedUser) {
  expect(page.url()).toContain(`/iam/user-detail/${target.id}`);
  expect(loaded.id).toBe(target.id);
  assertDummyTarget(loaded, target.email);
  await chooseMenuItem(page, "Deactivate account");
  const dialog = deactivateDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Deactivate account", exact: true }).click();
  await expect(
    notifications(page).getByText(STATUS_TEXT.deactivateSuccess, { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toBeHidden();
  await expect(statusValue(page)).toHaveText(/^Inactive$/, { timeout: 20_000 });
}

/** Reactivates the user on the open detail page through the ⋮ menu with `reason`. */
export async function activateViaMenu(page: Page, reason: string) {
  await chooseMenuItem(page, "Activate account");
  const dialog = activateDialog(page);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("textbox", { name: "Reason" }).fill(reason);
  await dialog.getByRole("button", { name: "Activate account", exact: true }).click();
  await expect(
    notifications(page).getByText(STATUS_TEXT.activateSuccess, { exact: true }),
  ).toBeVisible({ timeout: 20_000 });
  await expect(dialog).toBeHidden();
  await expect(statusValue(page)).toHaveText(/^Active$/, { timeout: 20_000 });
}

/**
 * Leaves the dummy U1 Active: re-activates it through the UI when deactivated or suspended
 * (reason "e2e cleanup"), or promotes it when it is still a pending invitee.
 */
export async function ensureDummyActive(page: Page, user: DummyUser, reason = "e2e cleanup") {
  const loaded = await openUserDetail(page, user.id);
  assertDummyTarget(loaded, user.email);
  if (loaded.accountState === "Active") return;
  if (loaded.accountState === "PendingVerification") {
    await promotePendingDummyToActive(page, user, reason);
    const promoted = await openUserDetail(page, user.id);
    expect(promoted.accountState).toBe("Active");
    return;
  }
  await activateViaMenu(page, reason);
  const reread = await reloadUserDetail(page, user.id);
  expect(reread.accountState).toBe("Active");
}

// ─── Screenshots (H15) ───────────────────────────────────────────────────────

export const SCREENSHOT_VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "768x1024", width: 768, height: 1024 },
  { name: "390x844", width: 390, height: 844 },
] as const;

export const SCREENSHOT_THEMES = ["light", "dark"] as const;

export async function applyTheme(page: Page, theme: (typeof SCREENSHOT_THEMES)[number]) {
  await page.emulateMedia({ colorScheme: theme });
  await page.evaluate(
    (dark) => document.documentElement.classList.toggle("dark", dark),
    theme === "dark",
  );
  if (theme === "dark") {
    await expect(page.locator("html")).toHaveClass(/\bdark\b/);
  } else {
    await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
  }
}

/** Saves a screenshot under the test's output dir (never the repository) and attaches it. */
export async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const file = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path: file, animations: "disabled" });
  await testInfo.attach(name, { path: file, contentType: "image/png" });
}

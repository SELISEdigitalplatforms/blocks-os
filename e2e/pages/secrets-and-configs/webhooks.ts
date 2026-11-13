import { expect, type Locator, type Page, type Request, type Route } from "@playwright/test";
import type { TestInfo } from "@playwright/test";
import { buildProjectRouteUrl, gotoE2e } from "../../support/navigation";
import { openSecretManagement } from "../../support/os-helpers";
import { readOsProject } from "../../support/os-project";

/**
 * blocks-os#748: the webhook detail page (Secret management → Webhooks → one webhook).
 * Real journeys go through the console; the F-* states of spec §10 are served by `page.route`
 * mocks on the Webhooks API, keyed by fake ids that never exist on the server.
 */

// ---------------------------------------------------------------- API shapes (spec §6)

export type WebhookFixture = {
  id: string;
  name: string;
  url: string;
  isActive: boolean;
  actions: string[];
  secretSet: boolean;
  secretChangedDate: string | null;
  createdDate: string;
  createdBy: string | null;
  consecutiveFailures: number;
  disabledReason: string | null;
};

export type AttemptFixture = {
  no: number;
  at: string;
  httpStatus: number | null;
  durationMs: number;
  errorCode: string | null;
};

export type DeliveryStatus = "Pending" | "Retrying" | "Delivered" | "Failed" | "Skipped";

export type DeliveryFixture = {
  id: string;
  eventId: string;
  action: string;
  webhookId: string;
  status: DeliveryStatus;
  statusReason: string | null;
  body: string;
  traceId: string | null;
  createdDate: string;
  lastUpdatedDate: string;
  nextAttemptAt: string | null;
  attempts: AttemptFixture[];
};

export type DeliveryPage = { totalCount: number; items: DeliveryFixture[] };

// ---------------------------------------------------------------- texts (os.webhooks.en.json)

export const WEBHOOK_TEXT = {
  addTitle: "Add webhook",
  save: "Save webhook",
  sendTest: "Send test",
  moreActions: "More actions",
  turnOff: "Turn off",
  turnOn: "Turn on",
  deleteWebhook: "Delete webhook",
  copyUrl: "Copy endpoint URL",
  back: "All webhooks",
  backToList: "Back to webhooks",
  notFound: "This webhook does not exist.",
  notFoundDescription:
    "It may have been deleted. Its history is kept, but the webhook can no longer be opened.",
  loadFailed: "Could not load this webhook.",
  autoOffTitle: "Blocks stopped sending to this webhook after repeated failures.",
  signingSecret: "Signing secret",
  created: "Created",
  failures: "Failures in a row",
  actionsItReceives: "Actions it receives",
  manageActions: "Manage actions",
  history: "History",
  historyNote:
    "Keeps the sent event (no personal data) so it can be sent again. Never the response body, headers or secret.",
  historyEmpty: "No events match.",
  historyLoadFailed: "Could not load the history.",
  noAttempts: "No attempts yet.",
  copyBody: "Copy sent event",
  openTrace: "Open trace",
  resendQueued: "The event was sent again.",
  couldNotResend: "Could not resend",
  inFlight: "This event is being sent right now. Try again in a moment.",
  notResendable: "Only delivered or failed events can be sent again.",
  filterAction: "Filter by action",
  filterStatus: "Filter by status",
  testSent: "Test sent",
  couldNotSave: "Could not save the webhook",
  couldNotDelete: "Could not delete the webhook",
  deleteTitle: "Delete this webhook?",
  nameTaken: "Another webhook already uses this name.",
  notFoundAnyMore: "This webhook does not exist any more.",
  added: (name: string) => `Webhook "${name}" was added.`,
  turnedOff: (name: string) => `Webhook "${name}" is off.`,
  turnedOn: (name: string) => `Webhook "${name}" is on.`,
  deleted: (name: string) => `Webhook "${name}" was deleted.`,
  autoOffBody: (reason: string) => `Reason: ${reason}. Fix the endpoint, then turn it on.`,
} as const;

// ---------------------------------------------------------------- URLs

const WEBHOOK_GET = /\/api\/Webhooks\/Get\?/i;
const WEBHOOK_GETS = /\/api\/Webhooks\/Gets\/?(\?.*)?$/i;
const WEBHOOK_SAVE = /\/api\/Webhooks\/Save\/?$/i;
const WEBHOOK_DELETE = /\/api\/Webhooks\/Delete\/?$/i;
const WEBHOOK_TEST = /\/api\/Webhooks\/Test\/?$/i;
const WEBHOOK_DELIVERIES = /\/api\/Webhooks\/Deliveries\?/i;
const WEBHOOK_RESEND = /\/api\/Webhooks\/Resend\/?$/i;
export const WEBHOOKS_API = /\/api\/Webhooks\//i;

export const isDeliveriesRequest = (request: Request) => WEBHOOK_DELIVERIES.test(request.url());
export const isWebhookGetRequest = (request: Request) => WEBHOOK_GET.test(request.url());
export const isSaveRequest = (request: Request) =>
  request.method() === "POST" && WEBHOOK_SAVE.test(request.url());
export const isResendRequest = (request: Request) =>
  request.method() === "POST" && WEBHOOK_RESEND.test(request.url());

export const WEBHOOKS_LIST_PATH = /\/secret-management\/webhooks\/?$/;
/** URL predicate for a webhook's detail page (no RegExp built from the id). */
export const webhookDetailPath = (id: string) => (url: URL) =>
  url.pathname.replace(/\/$/, "").endsWith(`/secret-management/webhooks/${encodeURIComponent(id)}`);

// ---------------------------------------------------------------- real API helper

export type WebhooksApi = {
  base: string;
  headers: Record<string, string>;
};

const BROWSER_HEADERS = new Set([
  "accept-encoding",
  "accept-language",
  "connection",
  "content-length",
  "cookie",
  "host",
  "origin",
  "referer",
  "user-agent",
]);

function replayable(request: Request): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const [name, value] of Object.entries(request.headers())) {
    if (!BROWSER_HEADERS.has(name) && !name.startsWith("sec-") && !name.startsWith(":")) {
      headers[name] = value;
    }
  }
  headers["content-type"] = "application/json";
  return headers;
}

type ApiResult = { status: number; json: unknown };

async function callApi(
  page: Page,
  api: WebhooksApi,
  method: "GET" | "POST",
  path: string,
  body?: unknown,
): Promise<ApiResult> {
  return page.evaluate(
    async ({ url, method, headers, body }) => {
      const res = await fetch(url, {
        method,
        credentials: "include",
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      return { status: res.status, json };
    },
    { url: `${api.base}/${path}`, method, headers: api.headers, body },
  );
}

/** Opens the webhooks list and keeps the console's own Webhooks/Gets request for API calls. */
export async function openWebhooksListWithApi(page: Page): Promise<WebhooksApi> {
  const gets = page.waitForRequest((r) => r.method() === "GET" && WEBHOOK_GETS.test(r.url()), {
    timeout: 60_000,
  });
  await openSecretManagement(page, "webhooks", "Webhooks");
  const request = await gets;
  return {
    base: request.url().replace(/\/Gets\/?(\?.*)?$/i, ""),
    headers: replayable(request),
  };
}

export async function listWebhooks(page: Page, api: WebhooksApi): Promise<WebhookFixture[]> {
  const result = await callApi(page, api, "GET", "Gets");
  expect(result.status, "Webhooks/Gets").toBe(200);
  return Array.isArray(result.json) ? (result.json as WebhookFixture[]) : [];
}

export async function createWebhookViaApi(
  page: Page,
  api: WebhooksApi,
  payload: { name: string; url: string; secret: string; actions: string[] },
): Promise<WebhookFixture> {
  const result = await callApi(page, api, "POST", "Save", { ...payload, isActive: true });
  expect(result.status, JSON.stringify(result.json)).toBe(200);
  return result.json as WebhookFixture;
}

export async function deleteWebhookViaApi(page: Page, api: WebhooksApi, id: string) {
  return callApi(page, api, "POST", "Delete", { id });
}

/** Deletes every webhook whose name matches `owned` (the test's own names only). */
export async function deleteOwnedWebhooks(page: Page, api: WebhooksApi, owned: RegExp) {
  const deleted: string[] = [];
  for (const webhook of await listWebhooks(page, api)) {
    if (!owned.test(webhook.name)) continue;
    const result = await deleteWebhookViaApi(page, api, webhook.id);
    expect(result.status, `delete ${webhook.name}`).toBe(200);
    deleted.push(webhook.name);
  }
  return deleted;
}

type ActionRow = { name: string; webhook: boolean };

const actionsApi = (api: WebhooksApi): WebhooksApi => ({
  ...api,
  base: api.base.replace(/\/Webhooks$/i, "/Actions"),
});

async function actionRows(page: Page, api: WebhooksApi): Promise<ActionRow[]> {
  const result = await callApi(page, actionsApi(api), "GET", "Gets");
  expect(result.status, "Actions/Gets").toBe(200);
  return (Array.isArray(result.json) ? result.json : []) as ActionRow[];
}

async function setActionWebhook(page: Page, api: WebhooksApi, name: string, enabled: boolean) {
  const result = await callApi(page, actionsApi(api), "POST", "Update", {
    name,
    target: "webhook",
    enabled,
  });
  expect(result.status, `Actions/Update ${name} webhook=${enabled}`).toBe(200);
}

/**
 * `count` action names that can be sent to webhooks (the Add webhook dialog's choices). When the
 * project has fewer, the Webhook target is turned on for other actions for the test's duration;
 * `turnedOn` lists them so the caller turns them off again (the project is left as it was).
 */
export async function ensureWebhookActions(
  page: Page,
  api: WebhooksApi,
  count: number,
): Promise<{ names: string[]; turnedOn: string[] }> {
  const rows = await actionRows(page, api);
  const ready = rows.filter((row) => row.webhook).map((row) => row.name);
  const missing = Math.max(0, count - ready.length);
  const extra = rows
    .filter((row) => !row.webhook)
    .slice(0, missing)
    .map((row) => row.name);
  expect(
    ready.length + extra.length,
    `the shared project has ${rows.length} actions; the test needs ${count}`,
  ).toBeGreaterThanOrEqual(count);
  for (const name of extra) await setActionWebhook(page, api, name, true);
  return { names: [...ready.slice(0, count), ...extra].slice(0, count), turnedOn: extra };
}

/** Turns the Webhook target off again for actions the test turned it on for. */
export async function restoreWebhookActions(page: Page, api: WebhooksApi, names: string[]) {
  const rows = await actionRows(page, api);
  for (const name of names) {
    if (rows.find((row) => row.name === name)?.webhook) {
      await setActionWebhook(page, api, name, false);
    }
  }
}

// ---------------------------------------------------------------- navigation

export function webhookDetailUrl(id: string) {
  const fixture = readOsProject();
  if (!fixture?.itemId) throw new Error("Missing fixtures/os-project.json — run os-setup first.");
  return buildProjectRouteUrl(fixture.itemId, `secret-management/webhooks/${id}`);
}

/** Deep-links to a webhook's detail page (a full load, so no query cache is carried over). */
export async function gotoWebhookDetail(page: Page, id: string) {
  await gotoE2e(page, webhookDetailUrl(id));
  await expect(page).toHaveURL(webhookDetailPath(id), { timeout: 30_000 });
}

/**
 * Plain `page.goto` for the dark-theme pass: gotoE2e's app-shell probe looks for the light logo
 * (`img[alt="Logo"]`), misses it in the dark theme and waits 2 × 15 s per navigation.
 */
export async function gotoWebhookDetailDirect(page: Page, id: string) {
  await page.goto(webhookDetailUrl(id), { waitUntil: "domcontentloaded", timeout: 45_000 });
  await expect(page).toHaveURL(webhookDetailPath(id), { timeout: 30_000 });
}

// ---------------------------------------------------------------- locators

export const pageTitle = (page: Page) => page.getByRole("heading", { level: 1 });

/** The header Card: the nearest `bg-card` ancestor of the page's h1. */
export const headerCard = (page: Page) =>
  pageTitle(page).locator(
    "xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' bg-card ')][1]",
  );

export const breadcrumb = (page: Page) => page.getByRole("navigation", { name: "breadcrumb" });
export const backButton = (page: Page) =>
  page.getByRole("button", { name: WEBHOOK_TEXT.back, exact: true });
export const moreActionsButton = (page: Page) =>
  page.getByRole("button", { name: WEBHOOK_TEXT.moreActions, exact: true });
export const sendTestButton = (page: Page) =>
  page.getByRole("button", { name: WEBHOOK_TEXT.sendTest, exact: true });
export const turnOnButton = (page: Page) =>
  page.getByRole("button", { name: WEBHOOK_TEXT.turnOn, exact: true });
export const autoOffBanner = (page: Page) =>
  page.getByRole("alert").filter({ hasText: WEBHOOK_TEXT.autoOffTitle });
export const actionsSection = (page: Page) =>
  page.getByRole("region", { name: WEBHOOK_TEXT.actionsItReceives });
export const historySection = (page: Page) =>
  page.getByRole("region", { name: WEBHOOK_TEXT.history });
export const statusFilter = (page: Page) =>
  page.getByRole("combobox", { name: WEBHOOK_TEXT.filterStatus });
export const actionFilter = (page: Page) =>
  page.getByRole("combobox", { name: WEBHOOK_TEXT.filterAction });
export const rowToggle = (page: Page, eventId: string) =>
  page.getByRole("button", { name: `Details ${eventId}`, exact: true });
export const resendButton = (page: Page, eventId: string) =>
  page.getByRole("button", { name: `Resend ${eventId}`, exact: true });
/** The table row of a delivery (the row that holds its chevron). */
export const deliveryRow = (page: Page, eventId: string) =>
  page.getByRole("row").filter({ has: rowToggle(page, eventId) });
/** The expanded panel row of a delivery. */
export const deliveryPanel = (page: Page, deliveryId: string) =>
  page.locator(`[id="delivery-${deliveryId}"]`);
export const toast = (page: Page, text: string) => page.getByText(text, { exact: true }).first();

/** A fact cell's value, found by its label in the header card's facts strip. */
export const factLabel = (page: Page, label: string) =>
  headerCard(page).locator(`p:text-is(${JSON.stringify(label)})`);
export const factValue = (page: Page, label: string) =>
  factLabel(page, label).locator("xpath=following-sibling::div[1]");

export async function openMoreActions(page: Page) {
  await moreActionsButton(page).click();
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  return menu;
}

export async function closeMenu(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
}

export async function chooseFilter(page: Page, filter: Locator, option: string) {
  await filter.click();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(filter).toContainText(option);
}

/** Intl formatting the page uses (`formatDateTime`), computed in the browser's own locale. */
export async function formatDateTimeInPage(page: Page, iso: string): Promise<string> {
  return page.evaluate(
    (value) =>
      new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(
        new Date(value),
      ),
    iso,
  );
}

export async function hasNoHorizontalScroll(page: Page) {
  const sizes = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(sizes.scrollWidth, "document has no horizontal scroll").toBeLessThanOrEqual(
    sizes.clientWidth,
  );
}

export async function grantClipboard(page: Page) {
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
}

export const readClipboard = (page: Page) => page.evaluate(() => navigator.clipboard.readText());

/** Saves a full-page screenshot into the run's output folder and attaches it to the report. */
export async function snap(page: Page, testInfo: TestInfo, name: string) {
  const path = testInfo.outputPath(`webhook-details-${name}.png`);
  await page.screenshot({ path, fullPage: true, animations: "disabled" });
  await testInfo.attach(name, { path, contentType: "image/png" });
}

// ---------------------------------------------------------------- mocks (spec §10 fixtures)

const ISO_CREATED = "2026-10-30T08:00:00Z";

export function webhookFixture(
  overrides: Partial<WebhookFixture> & { id: string },
): WebhookFixture {
  return {
    name: "E2E mocked webhook",
    url: "https://hooks.example.com/blocks/e2e",
    isActive: true,
    actions: ["E2E.Mock.ActionOne", "E2E.Mock.ActionTwo", "E2E.Mock.ActionThree"],
    secretSet: true,
    secretChangedDate: "2026-11-01T08:00:00Z",
    createdDate: ISO_CREATED,
    createdBy: "usr_admin_07",
    consecutiveFailures: 0,
    disabledReason: null,
    ...overrides,
  };
}

/** An event body; with `padTo`, ~padTo bytes more spread over many lines once pretty-printed. */
const sampleBody = (eventId: string, action: string, padTo = 0) => {
  const body: Record<string, unknown> = {
    eventId,
    action,
    occurredAt: "2026-11-12T10:00:00Z",
    data: { itemId: `item-${eventId}`, status: "changed" },
  };
  if (padTo > 0) {
    body.items = Array.from({ length: Math.ceil(padTo / 80) }, (_, i) =>
      `line ${i} `.padEnd(80, "x"),
    );
  }
  return JSON.stringify(body);
};

export function deliveryFixture(
  webhookId: string,
  overrides: Partial<DeliveryFixture> & { id: string; status: DeliveryStatus },
): DeliveryFixture {
  const eventId = overrides.eventId ?? `evt-${overrides.id}`;
  const action = overrides.action ?? "E2E.Mock.ActionOne";
  return {
    eventId,
    action,
    webhookId,
    statusReason: null,
    body: sampleBody(eventId, action),
    traceId: null,
    createdDate: "2026-11-12T10:00:00Z",
    lastUpdatedDate: "2026-11-12T10:05:00Z",
    nextAttemptAt: null,
    attempts: [],
    ...overrides,
  };
}

/** F-history: six deliveries covering every status; the Failed one has a trace and 3 attempts. */
export function historyFixture(webhookId: string): DeliveryFixture[] {
  const attempt = (no: number, httpStatus: number | null, errorCode: string | null = null) => ({
    no,
    at: `2026-11-12T10:0${no}:00Z`,
    httpStatus,
    durationMs: 100 + no,
    errorCode,
  });
  return [
    deliveryFixture(webhookId, {
      id: "failed",
      eventId: "evt-failed",
      status: "Failed",
      statusReason: "HTTP_503",
      traceId: "7f3c1a9e42",
      attempts: [attempt(1, 503), attempt(2, 503), attempt(3, 503)],
    }),
    deliveryFixture(webhookId, {
      id: "delivered",
      eventId: "evt-delivered",
      status: "Delivered",
      traceId: "",
      attempts: [attempt(1, 200)],
    }),
    deliveryFixture(webhookId, {
      id: "delivered2",
      eventId: "evt-delivered2",
      action: "E2E.Mock.ActionTwo",
      status: "Delivered",
      traceId: "4b2d9c0a11",
      attempts: [attempt(1, 204)],
    }),
    deliveryFixture(webhookId, { id: "pending", eventId: "evt-pending", status: "Pending" }),
    deliveryFixture(webhookId, {
      id: "retrying",
      eventId: "evt-retrying",
      status: "Retrying",
      statusReason: "TIMEOUT",
      attempts: [attempt(1, null, "TIMEOUT")],
    }),
    deliveryFixture(webhookId, {
      id: "skipped",
      eventId: "evt-skipped",
      status: "Skipped",
      statusReason: "WEBHOOK_INACTIVE",
    }),
  ];
}

/** F-big: `count` rows with ~8 KB bodies. */
export function bigHistoryFixture(webhookId: string, count: number): DeliveryFixture[] {
  return Array.from({ length: count }, (_, index) =>
    deliveryFixture(webhookId, {
      id: `big-${index}`,
      eventId: `evt-big-${index}`,
      status: index % 2 === 0 ? "Delivered" : "Failed",
      body: sampleBody(`evt-big-${index}`, "E2E.Mock.ActionOne", 8_000),
      attempts: [
        {
          no: 1,
          at: "2026-11-12T10:01:00Z",
          httpStatus: index % 2 === 0 ? 200 : 500,
          durationMs: 120,
          errorCode: null,
        },
      ],
    }),
  );
}

type Reply = { status: number; json: unknown };
export type DeliveriesReply = (query: URLSearchParams) => Reply | Promise<Reply>;
export type WebhookReply = () => Reply | Promise<Reply>;

const errorBody = (code: string) => ({ isSuccess: false, errors: { code } });
export const replyError = (status: number, code?: string): Reply => ({
  status,
  json: code ? errorBody(code) : { isSuccess: false, errors: {} },
});

async function fulfill(route: Route, reply: Reply) {
  const origin = (await route.request().headerValue("origin")) ?? "*";
  await route.fulfill({
    status: reply.status,
    contentType: "application/json",
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-credentials": "true",
    },
    body: JSON.stringify(reply.json),
  });
}

/**
 * Serves one fake webhook (GET) and its history (Deliveries) from the test. Requests for any other
 * id fall through to the real API. Returns the requests seen, for request-count assertions.
 */
export class WebhookMock {
  readonly getRequests: Request[] = [];
  readonly deliveryQueries: URLSearchParams[] = [];
  private webhookReply: WebhookReply;
  private deliveriesReply: DeliveriesReply;

  constructor(
    private readonly page: Page,
    readonly id: string,
    webhook: WebhookReply,
    deliveries: DeliveriesReply = () => ({ status: 200, json: { totalCount: 0, items: [] } }),
  ) {
    this.webhookReply = webhook;
    this.deliveriesReply = deliveries;
  }

  setWebhook(reply: WebhookReply) {
    this.webhookReply = reply;
  }

  setDeliveries(reply: DeliveriesReply) {
    this.deliveriesReply = reply;
  }

  private readonly onGet = async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("id") !== this.id) return route.fallback();
    this.getRequests.push(route.request());
    return fulfill(route, await this.webhookReply());
  };

  private readonly onDeliveries = async (route: Route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.get("webhookId") !== this.id) return route.fallback();
    this.deliveryQueries.push(url.searchParams);
    return fulfill(route, await this.deliveriesReply(url.searchParams));
  };

  async install() {
    await this.page.route(WEBHOOK_GET, this.onGet);
    await this.page.route(WEBHOOK_DELIVERIES, this.onDeliveries);
    return this;
  }

  async uninstall() {
    await this.page.unroute(WEBHOOK_GET, this.onGet);
    await this.page.unroute(WEBHOOK_DELIVERIES, this.onDeliveries);
  }
}

export const okWebhook =
  (webhook: WebhookFixture): WebhookReply =>
  () => ({
    status: 200,
    json: webhook,
  });

/** Serves `items` paged as the server would, with `totalCount` (defaults to items.length). */
export const pagedDeliveries =
  (items: DeliveryFixture[], totalCount = items.length): DeliveriesReply =>
  (query) => {
    const size = Number(query.get("pageSize") ?? "10");
    const status = query.get("status");
    const filtered = status ? items.filter((item) => item.status === status) : items;
    return {
      status: 200,
      json: {
        totalCount: status ? filtered.length : totalCount,
        items: filtered.slice(0, size),
      } satisfies DeliveryPage,
    };
  };

/** A one-shot route on a POST endpoint that the test answers itself, when it chooses to. */
export class HeldRoute {
  readonly requests: Request[] = [];
  private release: ((reply: Reply | "continue") => void) | null = null;
  private arrived: (() => void) | null = null;
  private finished: (() => void) | null = null;
  readonly seen: Promise<void>;
  private readonly handled: Promise<void>;

  constructor(
    private readonly page: Page,
    private readonly url: RegExp,
  ) {
    this.seen = new Promise((resolve) => (this.arrived = resolve));
    this.handled = new Promise((resolve) => (this.finished = resolve));
  }

  private readonly handler = async (route: Route) => {
    // One request is held; anything else (or a second request) goes on as usual.
    if (route.request().method() !== "POST" || this.requests.length > 0) return route.fallback();
    this.requests.push(route.request());
    const decision = await new Promise<Reply | "continue">((resolve) => {
      this.release = resolve;
      this.arrived?.();
    });
    try {
      if (decision === "continue") await route.continue();
      else await fulfill(route, decision);
    } finally {
      this.finished?.();
    }
  };

  async install() {
    await this.page.route(this.url, this.handler);
    return this;
  }

  /** Answers the held request (a mocked reply, or "continue" to send it to the server). */
  async answer(reply: Reply | "continue") {
    await this.seen;
    this.release?.(reply);
    // Unroute only once the handler has answered: an unroute while it is pending hands the
    // request on by itself, and the handler's own answer then fails as "already handled".
    await this.handled;
    await this.page.unroute(this.url, this.handler);
  }
}

export const holdTest = (page: Page) => new HeldRoute(page, WEBHOOK_TEST).install();
export const holdSave = (page: Page) => new HeldRoute(page, WEBHOOK_SAVE).install();
export const holdDelete = (page: Page) => new HeldRoute(page, WEBHOOK_DELETE).install();
export const holdResend = (page: Page) => new HeldRoute(page, WEBHOOK_RESEND).install();

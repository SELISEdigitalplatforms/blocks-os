import fs from "node:fs";
import path from "node:path";
import { expect, type Locator, type Page, type Request } from "@playwright/test";
import { test } from "../../support/test-base";
import { openSecretManagement } from "../../support/os-helpers";
import { OS_SESSION_PATH } from "../../support/os-project";
import { setConsoleThemeFlow } from "../../pages/secrets-and-configs/oidc";
import {
  WEBHOOKS_API,
  WEBHOOKS_LIST_PATH,
  WEBHOOK_TEXT,
  WebhookMock,
  actionFilter,
  actionsSection,
  autoOffBanner,
  backButton,
  bigHistoryFixture,
  breadcrumb,
  chooseFilter,
  closeMenu,
  createWebhookViaApi,
  deleteOwnedWebhooks,
  deleteWebhookViaApi,
  deliveryPanel,
  deliveryRow,
  factLabel,
  factValue,
  formatDateTimeInPage,
  gotoWebhookDetail,
  grantClipboard,
  hasNoHorizontalScroll,
  headerCard,
  historyFixture,
  historySection,
  holdDelete,
  holdResend,
  holdSave,
  holdTest,
  isDeliveriesRequest,
  isSaveRequest,
  listWebhooks,
  moreActionsButton,
  okWebhook,
  openMoreActions,
  openWebhooksListWithApi,
  pageTitle,
  pagedDeliveries,
  readClipboard,
  replyError,
  resendButton,
  rowToggle,
  sendTestButton,
  snap,
  statusFilter,
  toast,
  turnOnButton,
  ensureWebhookActions,
  gotoWebhookDetailDirect,
  restoreWebhookActions,
  webhookDetailPath,
  webhookFixture,
  type DeliveriesReply,
  type DeliveryFixture,
  type WebhookFixture,
  type WebhookReply,
  type WebhooksApi,
} from "../../pages/secrets-and-configs/webhooks";

/**
 * blocks-os#748 — webhook detail page redesign. Spec §10 ordered actions 1–12.
 *
 * Steps 1–4 and 9 run against the real API on webhooks this file creates ("E2E detail <stamp>",
 * endpoint https://postman-echo.com/post, two actions, a 32-character dummy secret). Every other
 * state is served by `page.route` mocks on the Webhooks API for fake ids (F-active, F-off,
 * F-missing, F-error, F-history, F-big, F-slow); mocks are page-scoped and removed with the page.
 *
 * EXCLUDED on purpose: C15 (render-time p75 over 5 cold runs, bundle size, baseline request
 * comparison). That measurement is an open decision with a human, so this file measures no render
 * time at all.
 *
 * Screenshots (step 8 F-slow, step 11 dark pass and the light states) are written with
 * testInfo.outputPath and attached to the report; nothing is written into the repository.
 */

const STAMP = Date.now();
const MAIN_NAME = `E2E detail ${STAMP}`;
const SECOND_NAME = `E2E detail ${STAMP} B`;
/** Only webhooks this file creates (also leftovers of its own earlier runs). */
const OWNED = /^E2E detail \d{13}( B)?$/;
const ENDPOINT = "https://postman-echo.com/post";
const DUMMY_SECRET = "e2e-dummy-signing-secret-".padEnd(32, "0");

const DESKTOP = { width: 1440, height: 900 };
const TABLET = { width: 768, height: 1024 };
const MOBILE = { width: 375, height: 812 };
const VIEWPORTS = [DESKTOP, TABLET, MOBILE];

const RETRY = /^retry$/i;

/**
 * Actions whose Webhook target a test turned on because the shared project had fewer than two
 * (the Add webhook dialog only offers those). Each test turns them off again; afterAll is the net.
 * Kept in a file (e2e/test-results, git-ignored) because a failed test restarts the worker and a
 * crashed run must still be repaired by the next one.
 */
const TURNED_ON_FILE = path.resolve(
  __dirname,
  "../../test-results/webhook-748-turned-on-actions.json",
);

function readTurnedOn(): string[] {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(TURNED_ON_FILE, "utf8"));
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeTurnedOn(names: string[]) {
  fs.mkdirSync(path.dirname(TURNED_ON_FILE), { recursive: true });
  fs.writeFileSync(TURNED_ON_FILE, JSON.stringify([...new Set(names)].sort()));
}

/** Two webhook-capable action names; records the ones the test had to turn on. */
async function twoWebhookActions(page: Page, api: WebhooksApi) {
  const { names, turnedOn } = await ensureWebhookActions(page, api, 2);
  writeTurnedOn([...readTurnedOn(), ...turnedOn]);
  return { names, turnedOn };
}

async function restoreActions(page: Page, api: WebhooksApi, names: string[]) {
  if (names.length === 0) return;
  await restoreWebhookActions(page, api, names);
  writeTurnedOn(readTurnedOn().filter((name) => !names.includes(name)));
}

// ---------------------------------------------------------------- shared checks

/** Webhooks API requests made from now on (H11, C14: expanding rows must issue none). */
function countWebhookRequests(page: Page) {
  const seen: string[] = [];
  const listener = (request: Request) => {
    if (WEBHOOKS_API.test(request.url())) seen.push(`${request.method()} ${request.url()}`);
  };
  page.on("request", listener);
  return {
    seen,
    stop: () => page.off("request", listener),
  };
}

async function expectBadges(page: Page, expected: string[], absent: string[]) {
  const card = headerCard(page);
  for (const text of expected) await expect(card.getByText(text, { exact: true })).toBeVisible();
  for (const text of absent) await expect(card.getByText(text, { exact: true })).toHaveCount(0);
}

async function expectMenuItems(page: Page, items: string[]) {
  const menu = await openMoreActions(page);
  await expect(menu.getByRole("menuitem")).toHaveText(items);
  await closeMenu(page);
}

async function expectFailures(page: Page, count: number) {
  const value = factValue(page, WEBHOOK_TEXT.failures).locator("span");
  await expect(value).toHaveText(String(count));
  await expect(value).toHaveClass(/tabular-nums/);
  if (count > 0) await expect(value).toHaveClass(/\btext-error\b/);
  else await expect(value).not.toHaveClass(/\btext-error\b/);
}

/** H8: three facts, in one row from md up, stacked below. */
async function expectFactsLayout(page: Page, stacked: boolean) {
  const labels = [WEBHOOK_TEXT.signingSecret, WEBHOOK_TEXT.created, WEBHOOK_TEXT.failures];
  const strip = headerCard(page).locator(":scope > div.grid");
  await expect(strip.locator(":scope > div")).toHaveCount(3);
  const boxes = [];
  for (const label of labels) {
    const box = await factLabel(page, label).boundingBox();
    expect(box, `${label} fact is laid out`).not.toBeNull();
    boxes.push(box!);
  }
  if (stacked) {
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].y);
    expect(Math.abs(boxes[1].x - boxes[0].x)).toBeLessThan(2);
  } else {
    expect(Math.abs(boxes[1].y - boxes[0].y)).toBeLessThan(2);
    expect(Math.abs(boxes[2].y - boxes[0].y)).toBeLessThan(2);
    expect(boxes[1].x).toBeGreaterThan(boxes[0].x);
    expect(boxes[2].x).toBeGreaterThan(boxes[1].x);
  }
}

/** H1: breadcrumb with links to Secret management and the list; the page is aria-current. */
async function expectBreadcrumb(page: Page, name: string) {
  const crumbs = breadcrumb(page);
  await expect(crumbs).toBeVisible();
  // The section labels are the sidebar's own texts (spec §4: reuse existing nav keys).
  await expect(
    crumbs.getByRole("link", { name: "Secrets & Configs", exact: true }),
  ).toHaveAttribute("href", /\/secret-management\/?$/);
  await expect(crumbs.getByRole("link", { name: "Webhooks", exact: true })).toHaveAttribute(
    "href",
    /\/secret-management\/webhooks\/?$/,
  );
  await expect(crumbs.locator('[aria-current="page"]')).toHaveText(name);
  await expect(backButton(page)).toBeHidden();
}

/** H3: one card holds name, badges, endpoint, actions and facts; the name is the only h1. */
async function expectHeaderCard(page: Page, name: string) {
  await expect(pageTitle(page)).toHaveCount(1);
  const title = pageTitle(page);
  await expect(title).toHaveText(name);
  for (const cls of ["text-xl", "sm:text-2xl", "font-semibold", "text-high-emphasis"]) {
    await expect(title).toHaveClass(new RegExp(`(^|\\s)${cls.replace(":", "\\:")}(\\s|$)`));
  }
  const card = headerCard(page);
  await expect(card).toHaveClass(/\bbg-card\b/);
  await expect(card.getByText(WEBHOOK_TEXT.signingSecret, { exact: true })).toBeVisible();
  await expect(card.getByRole("button", { name: WEBHOOK_TEXT.sendTest })).toBeVisible();
  await expect(card.getByRole("button", { name: /^Edit$/i })).toBeVisible();
  await expect(card.getByRole("button", { name: WEBHOOK_TEXT.moreActions })).toBeVisible();
  await expect(card.getByRole("button", { name: WEBHOOK_TEXT.copyUrl })).toBeVisible();
}

/** H5: POST tag, then the full URL on one truncated line with the URL in its title. */
async function expectEndpoint(page: Page, url: string) {
  const card = headerCard(page);
  await expect(card.getByText("POST", { exact: true })).toBeVisible();
  const urlText = card.locator(`span[title="${url}"]`);
  await expect(urlText).toHaveText(url);
  await expect(urlText).toHaveClass(/\btruncate\b/);
  await expect(urlText).toHaveCSS("white-space", "nowrap");
  await expect(urlText).toHaveCSS("text-overflow", "ellipsis");
}

/** H9: Actions it receives — header bar with count and Manage actions, one mono badge each. */
async function expectActionsCard(page: Page, actions: string[]) {
  const section = actionsSection(page);
  await expect(
    section.getByRole("heading", { level: 2, name: WEBHOOK_TEXT.actionsItReceives }),
  ).toBeVisible();
  await expect(section.locator("span.rounded-full")).toHaveText(String(actions.length));
  await expect(
    section.getByRole("link", { name: WEBHOOK_TEXT.manageActions, exact: true }),
  ).toHaveAttribute("href", /\/secret-management\/actions\/?$/);
  const badges = section.locator("li");
  await expect(badges).toHaveCount(actions.length);
  await expect(badges).toHaveText(actions, { useInnerText: true });
  for (let i = 0; i < actions.length; i++) {
    await expect(badges.nth(i).locator(":scope > *")).toHaveClass(/\bfont-mono\b/);
  }
}

/** H10: title, count pill and both filters in one header bar, the note strip, then the body. */
async function expectHistoryCard(page: Page, total: number | null) {
  const section = historySection(page);
  const title = section.getByRole("heading", { level: 2, name: WEBHOOK_TEXT.history });
  await expect(title).toBeVisible();
  if (total !== null) await expect(section.locator("span.rounded-full")).toHaveText(String(total));
  await expect(actionFilter(page)).toBeVisible();
  await expect(statusFilter(page)).toBeVisible();
  await expect(section.getByText(WEBHOOK_TEXT.historyNote, { exact: true })).toBeVisible();
}

async function setupMock(
  page: Page,
  id: string,
  webhook: WebhookFixture | WebhookReply,
  deliveries?: DeliveriesReply,
) {
  const reply = typeof webhook === "function" ? webhook : okWebhook(webhook);
  return new WebhookMock(page, id, reply, deliveries).install();
}

/** Deep-links to a mocked webhook (callers open the list first, which re-authenticates). */
async function openMocked(page: Page, id: string) {
  await gotoWebhookDetail(page, id);
}

async function waitForHistoryTable(page: Page, eventId: string) {
  await expect(rowToggle(page, eventId)).toBeVisible({ timeout: 30_000 });
}

function prettyBody(delivery: DeliveryFixture) {
  return JSON.stringify(JSON.parse(delivery.body), null, 2);
}

/** Relative luminance (0 black – 1 white) of a computed `rgb()/rgba()` colour. */
async function backgroundLuminance(locator: Locator): Promise<number> {
  const colour = await locator.evaluate((el) => getComputedStyle(el).backgroundColor);
  const [r, g, b] = (colour.match(/[\d.]+/g) ?? ["0", "0", "0"]).slice(0, 3).map(Number);
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

// ---------------------------------------------------------------- tests

test.describe("Webhook detail page (#748)", () => {
  test.afterAll(async ({ browser }) => {
    // Safety net: remove any webhook this file created that a failed test left behind.
    const context = await browser.newContext({
      storageState: OS_SESSION_PATH,
      ignoreHTTPSErrors: true,
    });
    const page = await context.newPage();
    try {
      const api = await openWebhooksListWithApi(page);
      await deleteOwnedWebhooks(page, api, OWNED);
      await restoreActions(page, api, readTurnedOn());
    } finally {
      await context.close();
    }
  });

  test("#748 H1 H3 H4 H5 H6 H7 H8 H9 H10 H15 H2 C4 C6 C7 C13: real webhook journey (§10 steps 1–4, 9)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    let api: WebhooksApi | undefined;
    let webhookId = "";
    let actions: string[] = [];
    let turnedOn: string[] = [];
    let createdDate = "";
    let createdBy: string | null = null;

    try {
      await test.step("Fixture: add webhook through the Add webhook dialog", async () => {
        api = await openWebhooksListWithApi(page);
        ({ names: actions, turnedOn } = await twoWebhookActions(page, api));
        // The dialog's action list is cached for a minute: reload so it offers the new ones.
        if (turnedOn.length > 0) api = await openWebhooksListWithApi(page);

        await page
          .getByRole("button", { name: WEBHOOK_TEXT.addTitle, exact: true })
          .first()
          .click();
        const dialog = page.getByRole("dialog", { name: WEBHOOK_TEXT.addTitle });
        await expect(dialog).toBeVisible();
        await dialog.getByLabel("Name", { exact: true }).fill(MAIN_NAME);
        await dialog.getByLabel("Endpoint URL", { exact: true }).fill(ENDPOINT);
        await dialog.getByLabel("Signing secret", { exact: true }).fill(DUMMY_SECRET);
        for (const name of actions) {
          const box = dialog.locator(`[id="webhook-action-${name}"]`);
          await box.click();
          await expect(box).toHaveAttribute("aria-checked", "true");
        }
        const saved = page.waitForResponse((r) => isSaveRequest(r.request()));
        await dialog.getByRole("button", { name: WEBHOOK_TEXT.save, exact: true }).click();
        const response = await saved;
        expect(response.status()).toBe(200);
        const body = (await response.json()) as WebhookFixture;
        webhookId = body.id;
        createdDate = body.createdDate;
        createdBy = body.createdBy;
        await expect(toast(page, WEBHOOK_TEXT.added(MAIN_NAME))).toBeVisible({ timeout: 15_000 });
        await expect(dialog).toBeHidden();
      });

      await test.step("§10 step 1: open it from the list; H1 H3 H4 H5 H8 H9 H10 C6", async () => {
        await page.getByRole("link", { name: MAIN_NAME, exact: true }).click();
        await expect(page).toHaveURL(webhookDetailPath(webhookId), { timeout: 15_000 });
        await expect(pageTitle(page)).toHaveText(MAIN_NAME, { timeout: 30_000 });

        await expectBreadcrumb(page, MAIN_NAME);
        await expectHeaderCard(page, MAIN_NAME);
        await expectBadges(page, ["Active"], ["Off", WEBHOOK_TEXT.autoOffTitle]);
        await expect(headerCard(page).getByText(/^\d+ failed$/)).toHaveCount(0);
        await expectEndpoint(page, ENDPOINT);

        await grantClipboard(page);
        await headerCard(page).getByRole("button", { name: WEBHOOK_TEXT.copyUrl }).click();
        await expect.poll(() => readClipboard(page)).toBe(ENDPOINT);

        await expectFactsLayout(page, false);
        await expect(factValue(page, WEBHOOK_TEXT.signingSecret)).toHaveText(
          /^Set · last changed .+ · never shown$/,
        );
        await expect(factValue(page, WEBHOOK_TEXT.created)).toHaveText(
          await formatDateTimeInPage(page, createdDate),
        );
        await expectFailures(page, 0);

        await expectActionsCard(page, actions);
        await expectHistoryCard(page, null);

        // C6: never the secret, never who created it.
        const text = await page.locator("body").innerText();
        expect(text).not.toContain(DUMMY_SECRET);
        if (createdBy) expect(text).not.toContain(createdBy);
      });

      await test.step("§10 step 2: Send test disables, spins, then toasts the result (H15)", async () => {
        const held = await holdTest(page);
        await sendTestButton(page).click();
        await held.seen;
        await expect(sendTestButton(page)).toBeDisabled();
        await expect(sendTestButton(page).locator(".animate-spin")).toBeVisible();
        await held.answer("continue");
        await expect(toast(page, WEBHOOK_TEXT.testSent)).toBeVisible({ timeout: 30_000 });
        await expect(page.getByText(/^HTTP 2\d\d in \d+ ms$/).first()).toBeVisible();
        await expect(sendTestButton(page)).toBeEnabled();
      });

      await test.step("§10 step 3: More actions → Turn off (H6), Turn on visible (H7), no banner (C4)", async () => {
        await expectMenuItems(page, [WEBHOOK_TEXT.turnOff, WEBHOOK_TEXT.deleteWebhook]);

        const menu = await openMoreActions(page);
        const off = page.waitForRequest(isSaveRequest);
        await menu.getByRole("menuitem", { name: WEBHOOK_TEXT.turnOff }).click();
        const offBody = (await off).postDataJSON() as Record<string, unknown>;
        expect(offBody).toEqual({
          id: webhookId,
          name: MAIN_NAME,
          url: ENDPOINT,
          isActive: false,
          actions,
        });
        expect(offBody).not.toHaveProperty("secret");
        await expect(toast(page, WEBHOOK_TEXT.turnedOff(MAIN_NAME))).toBeVisible({
          timeout: 15_000,
        });
        await expectBadges(page, ["Off"], ["Active"]);
        await expect(turnOnButton(page)).toBeVisible();
        await expect(autoOffBanner(page)).toHaveCount(0);
        await expectMenuItems(page, [WEBHOOK_TEXT.deleteWebhook]);

        const on = page.waitForRequest(isSaveRequest);
        await turnOnButton(page).click();
        const onBody = (await on).postDataJSON() as Record<string, unknown>;
        expect(onBody).toEqual({
          id: webhookId,
          name: MAIN_NAME,
          url: ENDPOINT,
          isActive: true,
          actions,
        });
        await expect(toast(page, WEBHOOK_TEXT.turnedOn(MAIN_NAME))).toBeVisible({
          timeout: 15_000,
        });
        await expectBadges(page, ["Active"], ["Off"]);
        await expect(turnOnButton(page)).toHaveCount(0);
      });

      await test.step("§10 step 4: 375×812 — back button instead of breadcrumb (H2), no page scroll (C13)", async () => {
        await page.setViewportSize(MOBILE);
        await expect(breadcrumb(page)).toBeHidden();
        await expect(backButton(page)).toBeVisible();
        await expectFactsLayout(page, true);
        await hasNoHorizontalScroll(page);
        await backButton(page).click();
        await expect(page).toHaveURL(WEBHOOKS_LIST_PATH, { timeout: 15_000 });
        await page.goBack();
        await expect(pageTitle(page)).toHaveText(MAIN_NAME, { timeout: 30_000 });
        await page.setViewportSize(DESKTOP);
      });

      await test.step("§10 step 9: Delete → Cancel keeps it; Delete → confirm returns to the list (C7)", async () => {
        let menu = await openMoreActions(page);
        await menu.getByRole("menuitem", { name: WEBHOOK_TEXT.deleteWebhook }).click();
        let dialog = page.getByRole("dialog", { name: WEBHOOK_TEXT.deleteTitle });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: /^Cancel$/i }).click();
        await expect(dialog).toBeHidden();
        await expect(page).toHaveURL(webhookDetailPath(webhookId));
        await expect(pageTitle(page)).toHaveText(MAIN_NAME);
        expect((await listWebhooks(page, api!)).some((w) => w.id === webhookId)).toBe(true);

        menu = await openMoreActions(page);
        await menu.getByRole("menuitem", { name: WEBHOOK_TEXT.deleteWebhook }).click();
        dialog = page.getByRole("dialog", { name: WEBHOOK_TEXT.deleteTitle });
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: /^Delete$/i }).click();
        await expect(page).toHaveURL(WEBHOOKS_LIST_PATH, { timeout: 15_000 });
        await expect(toast(page, WEBHOOK_TEXT.deleted(MAIN_NAME))).toBeVisible({ timeout: 15_000 });
        await expect(page.getByRole("link", { name: MAIN_NAME, exact: true })).toHaveCount(0);
        expect((await listWebhooks(page, api!)).some((w) => w.id === webhookId)).toBe(false);
        webhookId = "";
      });
    } finally {
      if (api && webhookId) await deleteWebhookViaApi(page, api, webhookId);
      if (api) await restoreActions(page, api, turnedOn);
    }
  });

  test("#748 C7 C8: delete and turn on/off failures keep the webhook as it was (§10 step 9)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    const api = await openWebhooksListWithApi(page);
    const { names: actions, turnedOn } = await twoWebhookActions(page, api);
    const second = await createWebhookViaApi(page, api, {
      name: SECOND_NAME,
      url: ENDPOINT,
      secret: DUMMY_SECRET,
      actions,
    });

    try {
      await gotoWebhookDetail(page, second.id);
      await expect(pageTitle(page)).toHaveText(SECOND_NAME, { timeout: 30_000 });

      await test.step("C7 failure: the dialog closes, the mapped error shows, nothing is deleted", async () => {
        const held = await holdDelete(page);
        const menu = await openMoreActions(page);
        await menu.getByRole("menuitem", { name: WEBHOOK_TEXT.deleteWebhook }).click();
        const dialog = page.getByRole("dialog", { name: WEBHOOK_TEXT.deleteTitle });
        await dialog.getByRole("button", { name: /^Delete$/i }).click();
        await held.seen;
        await expect(dialog.getByRole("button", { name: /^Delete$/i })).toBeDisabled();
        await held.answer(replyError(404, "WEBHOOK_NOT_FOUND"));
        await expect(dialog).toBeHidden();
        await expect(toast(page, WEBHOOK_TEXT.couldNotDelete)).toBeVisible({ timeout: 15_000 });
        await expect(toast(page, WEBHOOK_TEXT.notFoundAnyMore)).toBeVisible();
        await expect(page).toHaveURL(webhookDetailPath(second.id));
        await expect(pageTitle(page)).toHaveText(SECOND_NAME);
      });

      await test.step("C8 Turn off fails: control disabled while saving, status unchanged, error toast", async () => {
        const held = await holdSave(page);
        let menu = await openMoreActions(page);
        await menu.getByRole("menuitem", { name: WEBHOOK_TEXT.turnOff }).click();
        await held.seen;
        menu = await openMoreActions(page);
        await expect(menu.getByRole("menuitem", { name: WEBHOOK_TEXT.turnOff })).toHaveAttribute(
          "data-disabled",
          "",
        );
        await closeMenu(page);
        await held.answer(replyError(400, "WEBHOOK_NAME_TAKEN"));
        await expect(toast(page, WEBHOOK_TEXT.couldNotSave)).toBeVisible({ timeout: 15_000 });
        await expect(toast(page, WEBHOOK_TEXT.nameTaken)).toBeVisible();
        await expectBadges(page, ["Active"], ["Off"]);
        await expect(turnOnButton(page)).toHaveCount(0);
      });

      await test.step("C8 Turn on fails: button disabled while saving, still Off, error toast", async () => {
        const menu = await openMoreActions(page);
        await menu.getByRole("menuitem", { name: WEBHOOK_TEXT.turnOff }).click();
        await expect(toast(page, WEBHOOK_TEXT.turnedOff(SECOND_NAME))).toBeVisible({
          timeout: 15_000,
        });
        await expect(turnOnButton(page)).toBeVisible();

        const held = await holdSave(page);
        await turnOnButton(page).click();
        await held.seen;
        await expect(turnOnButton(page)).toBeDisabled();
        await held.answer(replyError(400, "WEBHOOK_NAME_TAKEN"));
        await expect(toast(page, WEBHOOK_TEXT.couldNotSave)).toBeVisible({ timeout: 15_000 });
        await expectBadges(page, ["Off"], ["Active"]);
        await expect(turnOnButton(page)).toBeEnabled();
      });
    } finally {
      await deleteWebhookViaApi(page, api, second.id);
      await restoreActions(page, api, turnedOn);
    }
  });

  test("#748 H10 H11 H12 C10 C11 E4 E5: F-history rows expand to attempts, sent event and trace (§10 step 5)", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(DESKTOP);
    const id = "e2e748-history";
    const items = historyFixture(id);
    const failed = items[0];
    await openSecretManagement(page, "webhooks", "Webhooks");
    await setupMock(page, id, webhookFixture({ id }), pagedDeliveries(items, 16));
    await openMocked(page, id);
    await waitForHistoryTable(page, failed.eventId);

    await test.step("H10: header bar, note strip, table and compact pagination in one card", async () => {
      await expectHistoryCard(page, 16);
      const section = historySection(page);
      const titleBox = await section.getByRole("heading", { level: 2 }).boundingBox();
      const filterBox = await statusFilter(page).boundingBox();
      expect(
        Math.abs(titleBox!.y + titleBox!.height / 2 - (filterBox!.y + filterBox!.height / 2)),
      ).toBeLessThan(12);
      await expect(section.getByRole("table")).toBeVisible();
      await expect(section.getByText("Page 1 of 2", { exact: true })).toBeVisible();
      await expect(section.getByRole("button", { name: "Go to next page" })).toBeVisible();
    });

    await test.step("H11 E4: a row click expands the Failed row without a request; H12 trace link", async () => {
      await grantClipboard(page);
      const requests = countWebhookRequests(page);
      await deliveryRow(page, failed.eventId).getByText(failed.eventId, { exact: true }).click();
      const toggle = rowToggle(page, failed.eventId);
      await expect(toggle).toHaveAttribute("aria-expanded", "true");
      await expect(toggle.locator("svg")).toHaveClass(/\brotate-90\b/);

      const panel = deliveryPanel(page, failed.id);
      await expect(panel).toBeVisible();
      const attempts = panel.getByRole("table");
      await expect(attempts.getByRole("columnheader")).toHaveText([
        "#",
        "Time",
        "Result",
        "Duration",
      ]);
      const results = attempts.getByRole("row").filter({ hasText: "HTTP 503" });
      await expect(results).toHaveCount(3);
      for (let i = 0; i < 3; i++) {
        await expect(results.nth(i).getByText("HTTP 503", { exact: true })).toHaveClass(
          /\btext-error\b/,
        );
      }
      await expect(panel.locator("pre")).toHaveText(prettyBody(failed));
      await panel.getByRole("button", { name: WEBHOOK_TEXT.copyBody }).click();
      await expect.poll(() => readClipboard(page)).toBe(failed.body);
      await expect(panel.getByRole("link", { name: WEBHOOK_TEXT.openTrace })).toHaveAttribute(
        "href",
        /\/lmt\/tracing\/7f3c1a9e42$/,
      );
      requests.stop();
      expect(requests.seen, "expanding a row issues no Webhooks API request").toEqual([]);
      await snap(page, testInfo, "light-1440-history-expanded-failed");

      await toggle.click();
      await expect(toggle).toHaveAttribute("aria-expanded", "false");
      await expect(panel).toHaveCount(0);
    });

    await test.step("C11 E5: Pending has no attempts, no trace link, no Resend; Skipped and Retrying no Resend", async () => {
      const pending = items.find((d) => d.status === "Pending")!;
      await rowToggle(page, pending.eventId).click();
      const panel = deliveryPanel(page, pending.id);
      await expect(panel.getByText(WEBHOOK_TEXT.noAttempts, { exact: true })).toBeVisible();
      await expect(panel.getByRole("table")).toHaveCount(0);
      await expect(panel.getByRole("link", { name: WEBHOOK_TEXT.openTrace })).toHaveCount(0);
      await expect(resendButton(page, pending.eventId)).toHaveCount(0);
      await snap(page, testInfo, "light-1440-history-expanded-pending");
      await rowToggle(page, pending.eventId).click();

      const skipped = items.find((d) => d.status === "Skipped")!;
      await rowToggle(page, skipped.eventId).click();
      await expect(
        deliveryPanel(page, skipped.id).getByText(WEBHOOK_TEXT.noAttempts, { exact: true }),
      ).toBeVisible();
      await expect(resendButton(page, skipped.eventId)).toHaveCount(0);
      await rowToggle(page, skipped.eventId).click();

      await expect(resendButton(page, "evt-retrying")).toHaveCount(0);
      await expect(resendButton(page, "evt-delivered")).toBeVisible();
      await expect(resendButton(page, failed.eventId)).toBeVisible();
    });

    await test.step("C10: an empty traceId shows no Open trace link", async () => {
      const delivered = items.find((d) => d.id === "delivered")!;
      await rowToggle(page, delivered.eventId).click();
      const panel = deliveryPanel(page, delivered.id);
      await expect(panel.locator("pre")).toBeVisible();
      await expect(panel.getByRole("link", { name: WEBHOOK_TEXT.openTrace })).toHaveCount(0);
      await expect(panel.getByText("HTTP 200", { exact: true })).toHaveClass(/\btext-success\b/);
      await rowToggle(page, delivered.eventId).click();
    });

    await test.step("H12: following Open trace opens the LMT trace detail route in the same tab", async () => {
      await rowToggle(page, failed.eventId).click();
      const pagesBefore = page.context().pages().length;
      await deliveryPanel(page, failed.id)
        .getByRole("link", { name: WEBHOOK_TEXT.openTrace })
        .click();
      await expect(page).toHaveURL(/\/lmt\/tracing\/7f3c1a9e42$/, { timeout: 15_000 });
      expect(page.context().pages().length).toBe(pagesBefore);
      await expect(historySection(page)).toHaveCount(0);
    });
  });

  test("#748 H13 C9: Resend one row only, in-flight and error toasts (§10 step 6)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    const id = "e2e748-resend";
    const items = historyFixture(id);
    await openSecretManagement(page, "webhooks", "Webhooks");
    await setupMock(page, id, webhookFixture({ id }), pagedDeliveries(items));
    await openMocked(page, id);
    await waitForHistoryTable(page, "evt-delivered");

    const resend = async (
      reply: Parameters<Awaited<ReturnType<typeof holdResend>>["answer"]>[0],
    ) => {
      const held = await holdResend(page);
      await resendButton(page, "evt-delivered").click();
      await held.seen;
      expect(held.requests[0].postDataJSON()).toEqual({ deliveryId: "delivered" });
      await expect(resendButton(page, "evt-delivered")).toBeDisabled();
      await expect(resendButton(page, "evt-failed")).toBeEnabled();
      await held.answer(reply);
      await expect(resendButton(page, "evt-delivered")).toBeEnabled({ timeout: 15_000 });
      await expect(rowToggle(page, "evt-delivered")).toHaveAttribute("aria-expanded", "false");
      expect(held.requests).toHaveLength(1);
    };

    await test.step("H13: Resend on a Delivered row resends that delivery only, row stays closed", async () => {
      await expect(resendButton(page, "evt-delivered").locator("svg")).toHaveCount(1);
      await resend({ status: 200, json: true });
      await expect(toast(page, WEBHOOK_TEXT.resendQueued)).toBeVisible({ timeout: 15_000 });
    });

    await test.step("C9: DELIVERY_IN_FLIGHT shows the info toast and re-enables Resend", async () => {
      await resend(replyError(409, "DELIVERY_IN_FLIGHT"));
      await expect(toast(page, WEBHOOK_TEXT.inFlight)).toBeVisible({ timeout: 15_000 });
    });

    await test.step("C9: any other error shows the mapped error toast", async () => {
      await resend(replyError(400, "DELIVERY_NOT_RESENDABLE"));
      await expect(toast(page, WEBHOOK_TEXT.couldNotResend)).toBeVisible({ timeout: 15_000 });
      await expect(toast(page, WEBHOOK_TEXT.notResendable)).toBeVisible();
    });
  });

  test("#748 H14 C12: filters restart at page 1; empty and failed history stay in the card (§10 step 7)", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(DESKTOP);
    const id = "e2e748-filters";
    const items = historyFixture(id);
    await openSecretManagement(page, "webhooks", "Webhooks");
    const mock = await setupMock(page, id, webhookFixture({ id }), pagedDeliveries(items, 16));
    await openMocked(page, id);
    await waitForHistoryTable(page, "evt-failed");
    const section = historySection(page);

    await test.step("H14: on page 2, choosing status Failed requests status=Failed&page=1", async () => {
      const page2 = page.waitForRequest(
        (r) => isDeliveriesRequest(r) && new URL(r.url()).searchParams.get("page") === "2",
      );
      await section.getByRole("button", { name: "Go to next page" }).click();
      await page2;
      await expect(section.getByText("Page 2 of 2", { exact: true })).toBeVisible();

      const filtered = page.waitForRequest(
        (r) => isDeliveriesRequest(r) && new URL(r.url()).searchParams.get("status") === "Failed",
      );
      await chooseFilter(page, statusFilter(page), "Failed");
      const query = new URL((await filtered).url()).searchParams;
      expect(query.get("status")).toBe("Failed");
      expect(query.get("page")).toBe("1");
      expect(query.get("webhookId")).toBe(id);
      await expectHistoryCard(page, 1);
      await expect(section.getByText("Page 1 of 1", { exact: true })).toBeVisible();

      const byAction = page.waitForRequest(
        (r) =>
          isDeliveriesRequest(r) &&
          new URL(r.url()).searchParams.get("action") === "E2E.Mock.ActionTwo",
      );
      await chooseFilter(page, actionFilter(page), "E2E.Mock.ActionTwo");
      const actionQuery = new URL((await byAction).url()).searchParams;
      expect(actionQuery.get("page")).toBe("1");
      expect(actionQuery.get("status")).toBe("Failed");
    });

    await test.step("C12 empty: No events match inside the card, filters still usable", async () => {
      mock.setDeliveries(() => ({ status: 200, json: { totalCount: 0, items: [] } }));
      await chooseFilter(page, statusFilter(page), "Skipped");
      await expect(section.getByText(WEBHOOK_TEXT.historyEmpty, { exact: true })).toBeVisible({
        timeout: 15_000,
      });
      await expectHistoryCard(page, 0);
      await expect(statusFilter(page)).toBeEnabled();
      await expect(actionFilter(page)).toBeEnabled();
      await snap(page, testInfo, "light-1440-history-empty");
    });

    await test.step("C12 error: Could not load the history + Retry inside the card; Retry refetches", async () => {
      mock.setDeliveries(() => replyError(500));
      await chooseFilter(page, statusFilter(page), "Retrying");
      await expect(section.getByText(WEBHOOK_TEXT.historyLoadFailed, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expectHistoryCard(page, null);
      await snap(page, testInfo, "light-1440-history-error");

      mock.setDeliveries(pagedDeliveries(items));
      const before = mock.deliveryQueries.length;
      await section.getByRole("button", { name: RETRY }).click();
      await waitForHistoryTable(page, "evt-retrying");
      expect(mock.deliveryQueries.length).toBeGreaterThan(before);
      await expect(section.getByText(WEBHOOK_TEXT.historyLoadFailed)).toHaveCount(0);
    });
  });

  test("#748 E1 E2 E3 E6 C1 C2 C3 C4 C5 C6: header states F-active, F-off, F-missing, F-error, F-slow (§10 step 8)", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(DESKTOP);
    await openSecretManagement(page, "webhooks", "Webhooks");

    await test.step("F-active (E1, E6, C6): Active only, Turn off + Delete, no banner, date-only Created", async () => {
      const id = "e2e748-active";
      const webhook = webhookFixture({ id, name: "E2E mocked active" });
      await setupMock(page, id, webhook);
      await openMocked(page, id);
      await expect(pageTitle(page)).toHaveText(webhook.name, { timeout: 30_000 });
      await expectBadges(page, ["Active"], ["Off", "Turned off after errors"]);
      await expect(headerCard(page).getByText(/^\d+ failed$/)).toHaveCount(0);
      await expectMenuItems(page, [WEBHOOK_TEXT.turnOff, WEBHOOK_TEXT.deleteWebhook]);
      await expect(autoOffBanner(page)).toHaveCount(0);
      await expect(factValue(page, WEBHOOK_TEXT.signingSecret)).toHaveText(
        `Set · last changed ${await formatDateTimeInPage(page, webhook.secretChangedDate!)} · never shown`,
      );
      await expect(factValue(page, WEBHOOK_TEXT.created)).toHaveText(
        await formatDateTimeInPage(page, webhook.createdDate),
      );
      await expectFailures(page, 0);
      expect(await page.locator("body").innerText()).not.toContain("usr_admin_07");
      await expectActionsCard(page, webhook.actions);
      await snap(page, testInfo, "light-1440-active");
    });

    await test.step("Active, failing (C5): N failed badge plus the number in text-error", async () => {
      const id = "e2e748-failing";
      await setupMock(page, id, webhookFixture({ id, consecutiveFailures: 3 }));
      await openMocked(page, id);
      await expect(pageTitle(page)).toBeVisible({ timeout: 30_000 });
      await expectBadges(page, ["Active", "3 failed"], ["Off"]);
      await expectFailures(page, 3);
      await expect(autoOffBanner(page)).toHaveCount(0);
    });

    await test.step("F-off (E2, C4, C5): Off + Turned off after errors, banner with code reason, Turn on", async () => {
      const id = "e2e748-off";
      await setupMock(
        page,
        id,
        webhookFixture({
          id,
          isActive: false,
          disabledReason: "TOO_MANY_FAILURES",
          consecutiveFailures: 10,
        }),
      );
      await openMocked(page, id);
      await expect(pageTitle(page)).toBeVisible({ timeout: 30_000 });
      await expectBadges(page, ["Off", "Turned off after errors"], ["Active"]);
      const banner = headerCard(page).getByRole("alert");
      await expect(banner).toBeVisible();
      await expect(banner).toContainText(WEBHOOK_TEXT.autoOffTitle);
      await expect(banner).toContainText(WEBHOOK_TEXT.autoOffBody("TOO_MANY_FAILURES"));
      await expect(banner.locator("code")).toHaveText("TOO_MANY_FAILURES");
      await expect(turnOnButton(page)).toBeVisible();
      await expectMenuItems(page, [WEBHOOK_TEXT.deleteWebhook]);
      await expectFailures(page, 10);
      await snap(page, testInfo, "light-1440-off-after-errors");
    });

    await test.step("Off by a person (C4): no banner when disabledReason is null", async () => {
      const id = "e2e748-off-person";
      await setupMock(page, id, webhookFixture({ id, isActive: false }));
      await openMocked(page, id);
      await expect(pageTitle(page)).toBeVisible({ timeout: 30_000 });
      await expectBadges(page, ["Off"], ["Active", "Turned off after errors"]);
      await expect(turnOnButton(page)).toBeVisible();
      await expect(
        page.getByRole("alert").filter({ hasText: WEBHOOK_TEXT.autoOffTitle }),
      ).toHaveCount(0);
    });

    await test.step("F-missing (C1, E3): not-found empty state, no Retry, Back to webhooks", async () => {
      const id = "e2e748-missing";
      await setupMock(page, id, () => replyError(404, "WEBHOOK_NOT_FOUND"));
      await openMocked(page, id);
      await expect(page.getByText(WEBHOOK_TEXT.notFound, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(page.getByText(WEBHOOK_TEXT.notFoundDescription, { exact: true })).toBeVisible();
      await expect(breadcrumb(page)).toBeVisible();
      await expect(page.getByRole("button", { name: RETRY })).toHaveCount(0);
      await snap(page, testInfo, "light-1440-missing");
      await page.getByRole("button", { name: WEBHOOK_TEXT.backToList, exact: true }).click();
      await expect(page).toHaveURL(WEBHOOKS_LIST_PATH, { timeout: 15_000 });
    });

    await test.step("F-error (C2): load-failed empty state; Retry refetches the webhook", async () => {
      const id = "e2e748-error";
      const mock = await setupMock(page, id, () => replyError(500));
      await openMocked(page, id);
      await expect(page.getByText(WEBHOOK_TEXT.loadFailed, { exact: true })).toBeVisible({
        timeout: 30_000,
      });
      await expect(
        page.getByText("Check your connection and try again.", { exact: true }),
      ).toBeVisible();
      await snap(page, testInfo, "light-1440-error");
      const before = mock.getRequests.length;
      mock.setWebhook(okWebhook(webhookFixture({ id, name: "E2E mocked recovered" })));
      await page.getByRole("button", { name: RETRY }).click();
      await expect(pageTitle(page)).toHaveText("E2E mocked recovered", { timeout: 30_000 });
      expect(mock.getRequests.length).toBeGreaterThan(before);
    });

    await test.step("F-slow (C3): skeletons in the page's shape, no spinner", async () => {
      // The fixture's "3 s delay" is a held response: it is answered only after the skeleton was
      // checked and captured, so the test never sleeps and never races the delay.
      const id = "e2e748-slow";
      let release: () => void = () => undefined;
      const gate = new Promise<void>((resolve) => (release = resolve));
      await setupMock(page, id, async () => {
        await gate;
        return { status: 200, json: webhookFixture({ id, name: "E2E mocked slow" }) };
      });
      await openMocked(page, id);
      const loading = page.getByTestId("webhook-details-loading");
      await expect(loading).toBeVisible({ timeout: 30_000 });
      await expect(loading.locator(".animate-pulse")).toHaveCount(21);
      await expect(loading.locator(":scope > .animate-pulse").first()).toHaveClass(
        /\bh-4\b.*\bw-64\b/,
      );
      await expect(loading.locator("xpath=..").locator(".animate-spin")).toHaveCount(0);
      await snap(page, testInfo, "light-1440-loading");
      release();
      await expect(pageTitle(page)).toHaveText("E2E mocked slow", { timeout: 30_000 });
    });
  });

  test("#748 C16: keyboard-only pass over the page with F-history (§10 step 10)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP);
    const id = "e2e748-keyboard";
    const items = historyFixture(id);
    await openSecretManagement(page, "webhooks", "Webhooks");
    await setupMock(page, id, webhookFixture({ id }), pagedDeliveries(items, 16));
    await openMocked(page, id);
    await waitForHistoryTable(page, "evt-failed");

    type Focused = { name: string; ring: boolean; expanded: string | null; tag: string };
    const focused = () =>
      page.evaluate((): Focused => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return { name: "", ring: false, expanded: null, tag: "" };
        const style = getComputedStyle(el);
        // A focus ring is a solid spread shadow (ring-2) or a real outline, not the kit's shadow-xs.
        const ring =
          /0px 0px 0px [1-9]/.test(style.boxShadow) ||
          (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0);
        const name = (el.getAttribute("aria-label") ?? el.innerText ?? "").trim();
        return { name, ring, expanded: el.getAttribute("aria-expanded"), tag: el.tagName };
      });

    // Start just before the breadcrumb: focus it, step back once, then only Tab forward.
    await breadcrumb(page).getByRole("link", { name: "Secrets & Configs" }).focus();
    await page.keyboard.press("Shift+Tab");

    const required = [
      "Secrets & Configs",
      "Webhooks",
      WEBHOOK_TEXT.copyUrl,
      WEBHOOK_TEXT.sendTest,
      "Edit",
      WEBHOOK_TEXT.moreActions,
      WEBHOOK_TEXT.manageActions,
      WEBHOOK_TEXT.filterAction,
      WEBHOOK_TEXT.filterStatus,
      "Details evt-failed",
      "Resend evt-failed",
      WEBHOOK_TEXT.copyBody,
      WEBHOOK_TEXT.openTrace,
      "Go to next page",
      "Go to last page",
    ];
    const reached = new Map<string, boolean>();
    let menuChecked = false;
    for (let i = 0; i < 120 && !reached.has("Go to last page"); i++) {
      await page.keyboard.press("Tab");
      const current = await focused();
      if (!reached.has(current.name)) reached.set(current.name, current.ring);

      if (current.name === WEBHOOK_TEXT.moreActions && !menuChecked) {
        menuChecked = true;
        await page.keyboard.press("Enter");
        const menu = page.getByRole("menu");
        await expect(menu).toBeVisible();
        await expect(menu.getByRole("menuitem", { name: WEBHOOK_TEXT.turnOff })).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(
          menu.getByRole("menuitem", { name: WEBHOOK_TEXT.deleteWebhook }),
        ).toBeFocused();
        await page.keyboard.press("Escape");
        await expect(menu).toHaveCount(0);
        await expect(moreActionsButton(page)).toBeFocused();
      }
      if (current.name === "Details evt-failed" && current.expanded === "false") {
        await page.keyboard.press("Enter");
        await expect(rowToggle(page, "evt-failed")).toHaveAttribute("aria-expanded", "true");
      }
    }

    expect(menuChecked, "More actions was reached and operated by keyboard").toBe(true);
    for (const name of required) {
      expect(reached.has(name), `${name} is reachable with Tab`).toBe(true);
      expect(reached.get(name), `${name} shows a visible focus ring`).toBe(true);
    }
  });

  test("#748 C17: dark theme pass — every state at 1440, 768 and 375 (§10 step 11)", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(DESKTOP);
    await openSecretManagement(page, "webhooks", "Webhooks");
    const items = historyFixture("e2e748-dark-history");

    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const states: {
      name: string;
      id: string;
      install: (id: string) => Promise<WebhookMock>;
      ready: () => Promise<void>;
    }[] = [
      {
        name: "active-history-expanded",
        id: "e2e748-dark-history",
        install: (id) => setupMock(page, id, webhookFixture({ id }), pagedDeliveries(items, 16)),
        ready: async () => {
          await waitForHistoryTable(page, "evt-failed");
          await rowToggle(page, "evt-failed").click();
          await rowToggle(page, "evt-pending").click();
          await expect(deliveryPanel(page, "failed")).toBeVisible();
        },
      },
      {
        name: "off-after-errors",
        id: "e2e748-dark-off",
        install: (id) =>
          setupMock(
            page,
            id,
            webhookFixture({
              id,
              isActive: false,
              disabledReason: "TOO_MANY_FAILURES",
              consecutiveFailures: 10,
            }),
          ),
        ready: () => expect(autoOffBanner(page)).toBeVisible({ timeout: 30_000 }),
      },
      {
        name: "missing",
        id: "e2e748-dark-missing",
        install: (id) => setupMock(page, id, () => replyError(404, "WEBHOOK_NOT_FOUND")),
        ready: () =>
          expect(page.getByText(WEBHOOK_TEXT.notFound, { exact: true })).toBeVisible({
            timeout: 30_000,
          }),
      },
      {
        name: "error",
        id: "e2e748-dark-error",
        install: (id) => setupMock(page, id, () => replyError(500)),
        ready: () =>
          expect(page.getByText(WEBHOOK_TEXT.loadFailed, { exact: true })).toBeVisible({
            timeout: 30_000,
          }),
      },
      {
        name: "history-empty",
        id: "e2e748-dark-empty",
        install: (id) => setupMock(page, id, webhookFixture({ id })),
        ready: () =>
          expect(page.getByText(WEBHOOK_TEXT.historyEmpty, { exact: true })).toBeVisible({
            timeout: 30_000,
          }),
      },
      {
        name: "history-error",
        id: "e2e748-dark-history-error",
        install: (id) => setupMock(page, id, webhookFixture({ id }), () => replyError(500)),
        ready: () =>
          expect(page.getByText(WEBHOOK_TEXT.historyLoadFailed, { exact: true })).toBeVisible({
            timeout: 30_000,
          }),
      },
      {
        name: "loading",
        id: "e2e748-dark-slow",
        install: (id) =>
          setupMock(page, id, async () => {
            await gate;
            return { status: 200, json: webhookFixture({ id }) };
          }),
        ready: () =>
          expect(page.getByTestId("webhook-details-loading")).toBeVisible({ timeout: 30_000 }),
      },
    ];

    try {
      await setConsoleThemeFlow(page, "dark");
      await expect(page.locator("html")).toHaveClass(/\bdark\b/);

      for (const state of states) {
        await test.step(`dark ${state.name}`, async () => {
          await page.setViewportSize(DESKTOP);
          await state.install(state.id);
          await gotoWebhookDetailDirect(page, state.id);
          await state.ready();
          await expect(page.locator("html")).toHaveClass(/\bdark\b/);
          for (const vp of VIEWPORTS) {
            await page.setViewportSize(vp);
            await snap(page, testInfo, `dark-${vp.width}x${vp.height}-${state.name}`);
          }
          await page.setViewportSize(DESKTOP);

          if (state.name === "active-history-expanded") {
            // No light-only surfaces: every card-like surface the page draws is dark.
            const surfaces: [string, Locator][] = [
              ["header card", headerCard(page)],
              ["actions card", actionsSection(page).locator(":scope > div").first()],
              ["history card", historySection(page).locator(":scope > div").first()],
              ["attempts table", deliveryPanel(page, "failed").locator("div.bg-card").first()],
              ["sent event", deliveryPanel(page, "failed").locator("div.relative.bg-card")],
            ];
            for (const [label, surface] of surfaces) {
              expect(await backgroundLuminance(surface), `${label} is dark`).toBeLessThan(0.2);
            }
            const menu = await openMoreActions(page);
            expect(await backgroundLuminance(menu), "menu is dark").toBeLessThan(0.2);
            for (const vp of VIEWPORTS) {
              await page.setViewportSize(vp);
              await expect(menu).toBeVisible();
              await snap(page, testInfo, `dark-${vp.width}x${vp.height}-menu-open`);
            }
            await page.setViewportSize(DESKTOP);
            await closeMenu(page);
          }
        });
      }
      release();
    } finally {
      release();
      await page.setViewportSize(DESKTOP);
      await setConsoleThemeFlow(page, "system").catch(() => undefined);
    }
  });

  test("#748 C13 C14: F-big — long name and URL at 375, 50 expanded 8 KB rows (§10 step 12)", async ({
    page,
  }, testInfo) => {
    const id = "e2e748-big";
    const name = "E2E long webhook name ".repeat(6).slice(0, 120);
    const url = `https://hooks.example.com/${"segment/".repeat(40)}`.slice(0, 300);
    expect(name).toHaveLength(120);
    expect(url).toHaveLength(300);
    const items = bigHistoryFixture(id, 50);

    await page.setViewportSize(MOBILE);
    await openSecretManagement(page, "webhooks", "Webhooks");
    await setupMock(page, id, webhookFixture({ id, name, url }), pagedDeliveries(items, 50));
    await openMocked(page, id);
    await expect(pageTitle(page)).toHaveText(name, { timeout: 30_000 });

    await test.step("C13: at 375 the name wraps, the URL truncates, the page has no horizontal scroll", async () => {
      await waitForHistoryTable(page, "evt-big-0");
      const title = await pageTitle(page).evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        right: el.getBoundingClientRect().right,
        lines: Math.round(
          el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight),
        ),
      }));
      expect(title.scrollWidth).toBeLessThanOrEqual(title.clientWidth);
      expect(title.right).toBeLessThanOrEqual(MOBILE.width);
      expect(title.lines, "the long name wraps").toBeGreaterThan(1);
      const urlText = headerCard(page).locator(`span[title="${url}"]`);
      await expect(urlText).toHaveText(url);
      const urlSize = await urlText.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
      }));
      expect(urlSize.scrollWidth, "the URL is truncated").toBeGreaterThan(urlSize.clientWidth);
      await hasNoHorizontalScroll(page);
      await snap(page, testInfo, "light-375-big-name-url");
    });

    await test.step("C14: 50 rows per page, all expanded, bodies capped and scrollable, no extra request", async () => {
      await page.setViewportSize(DESKTOP);
      const section = historySection(page);
      const sizeSelect = section.getByRole("combobox").filter({ hasText: /^10$/ });
      const fifty = page.waitForResponse(
        (r) =>
          isDeliveriesRequest(r.request()) &&
          new URL(r.url()).searchParams.get("pageSize") === "50",
      );
      await sizeSelect.click();
      await page.getByRole("option", { name: "50", exact: true }).click();
      await fifty;
      await expect(rowToggle(page, "evt-big-49")).toBeVisible({ timeout: 15_000 });

      const requests = countWebhookRequests(page);
      for (let i = 0; i < 50; i++) {
        await rowToggle(page, `evt-big-${i}`).click();
        await expect(rowToggle(page, `evt-big-${i}`)).toHaveAttribute("aria-expanded", "true");
      }
      const pres = section.locator("pre");
      await expect(pres).toHaveCount(50);
      const sizes = await pres.evaluateAll((els) =>
        els.map((el) => ({
          maxHeight: getComputedStyle(el).maxHeight,
          overflowY: getComputedStyle(el).overflowY,
          clientHeight: el.clientHeight,
          scrollHeight: el.scrollHeight,
        })),
      );
      for (const [i, size] of sizes.entries()) {
        expect(size.maxHeight, `body ${i} max-h-64`).toBe("256px");
        expect(size.clientHeight, `body ${i} no taller than max-h-64`).toBeLessThanOrEqual(256);
        expect(size.scrollHeight, `body ${i} scrolls`).toBeGreaterThan(size.clientHeight);
        expect(size.overflowY, `body ${i} overflow`).toBe("auto");
      }
      requests.stop();
      await testInfo.attach("c14-requests-after-expanding-50-rows.json", {
        body: JSON.stringify(requests.seen, null, 2),
        contentType: "application/json",
      });
      expect(requests.seen, "expanding 50 rows issues no Webhooks API request").toEqual([]);
      // The console scrolls its content area, not the document: find the history card's
      // scrolling ancestor and check it can scroll to the last row.
      const scrolls = await section.evaluate((el) => {
        for (let node = el.parentElement; node; node = node.parentElement) {
          const overflowY = getComputedStyle(node).overflowY;
          const scrollable = overflowY === "auto" || overflowY === "scroll";
          if (scrollable && node.scrollHeight > node.clientHeight) return true;
        }
        const doc = document.scrollingElement ?? document.documentElement;
        return doc.scrollHeight > doc.clientHeight;
      });
      expect(scrolls, "the page stays scrollable").toBe(true);
      await rowToggle(page, "evt-big-49").scrollIntoViewIfNeeded();
      await expect(rowToggle(page, "evt-big-49")).toBeInViewport();
    });
  });
});

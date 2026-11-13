import fs from "fs";
import { test, expect } from "../../support/test-base";
import { e2eBaseUrl } from "../../support/env";
import { openProjectOverview } from "../../support/os-helpers";
import { OS_SESSION_PATH } from "../../support/os-project";
import { navigateToUsersFlow, switchUserTabFlow } from "../../pages/identity-and-access/users";
import {
  IamTraffic,
  STATUS_TEXT,
  SCREENSHOT_THEMES,
  SCREENSHOT_VIEWPORTS,
  actionMenu,
  activateDialog,
  activateViaMenu,
  applyTheme,
  assertDummyTarget,
  attachScreenshot,
  chooseMenuItem,
  closeActionMenu,
  deactivateDialog,
  deactivateDummy,
  describeCalls,
  ensureDummyActive,
  expectMenuItems,
  findOrInviteDummyUser,
  findUserIdByEmail,
  menuStructure,
  moreActionsTrigger,
  notifications,
  openActionMenu,
  openUserDetail,
  reloadUserDetail,
  statusValue,
  u1Email,
  u2Email,
  type DummyUser,
  type IamCall,
} from "../../pages/identity-and-access/user-status";

// os#760 — IAM user detail ⋮ menu: deactivate and reactivate a user account (spec §10).
//
// Targets only two dummy users that this spec invites into the shared project's default
// organization: U1 (made Active for the spec, always left Active) and U2 (an invitee that never
// activates). Never the logged-in account: every deactivation asserts the target first.
//
// P1 baseline: no IAM request count was recorded at fb1ce04f (§10 step 0), so the load check
// asserts that two loads of U1's detail page send the same number of IAM requests, with exactly
// one user-by-id read each.

const DESKTOP = { width: 1440, height: 900 };
const DEACTIVATE_URL = /\/api\/iam\/users\/deactivate\/?$/;

let u1: DummyUser | null = null;
let u2: DummyUser | null = null;

async function resolveU1(page: import("@playwright/test").Page): Promise<DummyUser> {
  if (u1) return u1;
  const id = await findUserIdByEmail(page, u1Email());
  expect(id, "U1 must exist — run the #760 setup test first").not.toBeNull();
  u1 = { id: id as string, email: u1Email() };
  return u1;
}

async function resolveU2(page: import("@playwright/test").Page): Promise<DummyUser> {
  if (u2) return u2;
  const id = await findUserIdByEmail(page, u2Email());
  expect(id, "U2 must exist — run the #760 setup test first").not.toBeNull();
  u2 = { id: id as string, email: u2Email() };
  return u2;
}

/** IAM calls after `mark`, minus nothing: P3 allows exactly one POST then at most one user read. */
function expectSingleActionTraffic(calls: IamCall[], action: string, userId: string) {
  const posts = calls.filter((call) => call.method === "POST");
  expect(posts, `one POST per action, got: ${describeCalls(calls)}`).toHaveLength(1);
  expect(posts[0].path).toBe(`/api/iam/users/${action}`);
  const reads = calls.filter(
    (call) => call.method === "GET" && call.path === `/api/iam/users/${userId}`,
  );
  expect(reads.length, `at most one re-read of the user: ${describeCalls(calls)}`).toBeLessThan(2);
  expect(reads.length, `the user is re-read: ${describeCalls(calls)}`).toBe(1);
  expect(reads[0].seq).toBeGreaterThan(posts[0].seq);
  const ownRecord = calls.filter((call) => call.method === "GET" && call.path === "/api/iam/users");
  expect(ownRecord, "no refetch of the operator's own [user] record").toHaveLength(0);
  expect(calls.length, `nothing but the POST and the re-read: ${describeCalls(calls)}`).toBe(
    posts.length + reads.length,
  );
}

test.describe("#760 user status actions (⋮ menu)", () => {
  test.use({ viewport: DESKTOP });

  test.afterAll(async ({ browser }) => {
    // Safety net: U1 must end Active whatever happened above.
    const context = await browser.newContext({
      baseURL: e2eBaseUrl(),
      ignoreHTTPSErrors: true,
      viewport: DESKTOP,
      ...(fs.existsSync(OS_SESSION_PATH) ? { storageState: OS_SESSION_PATH } : {}),
    });
    const page = await context.newPage();
    try {
      const id = u1?.id ?? (await findUserIdByEmail(page, u1Email()));
      if (id) await ensureDummyActive(page, { id, email: u1Email() }, "e2e cleanup");
    } finally {
      await context.close();
    }
  });

  test("#760 setup: dummy U1 (Active) and U2 (PendingVerification) in the default organization", async ({
    page,
  }) => {
    const first = await findOrInviteDummyUser(page, u1Email());
    u1 = first;
    // Makes a fresh invitee Active and verified (IAM admin activate), or re-activates a U1 left
    // deactivated by an earlier failed run.
    await ensureDummyActive(page, first, "e2e setup: dummy user for #760");

    const second = await findOrInviteDummyUser(page, u2Email());
    u2 = second;
    const loaded = await openUserDetail(page, second.id);
    expect(loaded.email).toBe(u2Email());
    expect(loaded.accountState, "U2 must be a never-activated invitee").toBe("PendingVerification");
  });

  test("#760 H1 H13(P1): one ⋮ trigger, no standalone button, stable IAM request count on load", async ({
    page,
  }) => {
    const target = await resolveU1(page);
    const traffic = new IamTraffic(page);

    const counts: number[] = [];
    const readCounts: number[] = [];
    for (let load = 0; load < 2; load++) {
      const mark = traffic.mark();
      const loaded = await openUserDetail(page, target.id);
      assertDummyTarget(loaded, target.email);
      await traffic.waitForQuiet();
      const calls = traffic.since(mark);
      const reads = calls.filter(
        (call) => call.method === "GET" && call.path === `/api/iam/users/${target.id}`,
      );
      expect(reads.length, `the user is read on load: ${describeCalls(calls)}`).toBeGreaterThan(0);
      counts.push(calls.length);
      readCounts.push(reads.length);
    }
    expect(counts[1], `IAM requests per load: ${counts.join(" vs ")}`).toBe(counts[0]);
    expect(readCounts[1], `user-by-id reads per load: ${readCounts.join(" vs ")}`).toBe(
      readCounts[0],
    );
    test.info().annotations.push({
      type: "P1",
      description:
        `IAM requests on U1 detail load: ${counts[0]}, of which user-by-id reads: ` +
        `${readCounts[0]} (no fb1ce04f baseline recorded; stability between two loads asserted)`,
    });

    await expect(moreActionsTrigger(page)).toHaveCount(1);
    await expect(moreActionsTrigger(page)).toBeEnabled();
    await expect(
      page.getByRole("button", { name: /^(Reset Password|Resend Activation)$/ }).filter({
        visible: true,
      }),
    ).toHaveCount(0);
    await expect(statusValue(page)).toHaveText(/^Active$/);
  });

  test("#760 H2 H12 H14: Active menu lists Reset Password, separator, Deactivate account; keyboard; no requests", async ({
    page,
  }) => {
    const target = await resolveU1(page);
    const traffic = new IamTraffic(page);
    await openUserDetail(page, target.id);
    await traffic.waitForQuiet();
    const mark = traffic.mark();

    const menu = await openActionMenu(page);
    expect(await menuStructure(menu)).toEqual([
      "menuitem:Reset Password",
      "separator:",
      "menuitem:Deactivate account",
    ]);
    await expect(menu.getByRole("menuitem", { name: "Deactivate account" })).toHaveClass(
      /text-destructive/,
    );
    await closeActionMenu(page);

    // H14: keyboard. Enter opens with focus on the first item, arrows move, Escape closes.
    const trigger = moreActionsTrigger(page);
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Reset Password" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Deactivate account" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(trigger).toBeFocused();

    await page.keyboard.press("Space");
    await expect(menu).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "Reset Password" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(menu.getByRole("menuitem", { name: "Deactivate account" })).toBeFocused();
    await page.keyboard.press("Enter");
    const dialog = deactivateDialog(page);
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();

    await traffic.waitForQuiet();
    const calls = traffic.since(mark);
    expect(calls, `opening the menu or dialog sends nothing: ${describeCalls(calls)}`).toHaveLength(
      0,
    );
  });

  test("#760 H6 C9 H12: deactivate dialog copy; Cancel and Escape send nothing", async ({
    page,
  }) => {
    const target = await resolveU1(page);
    const traffic = new IamTraffic(page);
    await openUserDetail(page, target.id);
    await traffic.waitForQuiet();
    const mark = traffic.mark();

    await chooseMenuItem(page, "Deactivate account");
    const dialog = deactivateDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("heading", { name: STATUS_TEXT.deactivateTitle })).toBeVisible();
    await expect(
      dialog.getByText(STATUS_TEXT.deactivateDescription, { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    const confirm = dialog.getByRole("button", { name: "Deactivate account", exact: true });
    await expect(confirm).toBeVisible();
    await expect(confirm).toHaveClass(/destructive/);
    await expect(dialog.getByRole("textbox")).toHaveCount(0);
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(dialog).toBeHidden();

    await chooseMenuItem(page, "Deactivate account");
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();

    await traffic.waitForQuiet();
    const calls = traffic.since(mark);
    expect(calls, `cancel/escape send nothing: ${describeCalls(calls)}`).toHaveLength(0);
    await expect(statusValue(page)).toHaveText(/^Active$/);
  });

  test("#760 H5: Reset Password from the ⋮ menu sends the admin reset request for U1", async ({
    page,
  }) => {
    const target = await resolveU1(page);
    const loaded = await openUserDetail(page, target.id);
    assertDummyTarget(loaded, target.email);
    await chooseMenuItem(page, "Reset Password");
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("heading", { name: "Reset password" }) });
    await expect(dialog).toBeVisible();
    const requestPromise = page.waitForRequest(
      (request) =>
        /\/api\/iam\/users\/reset-password\/?$/.test(request.url()) && request.method() === "POST",
    );
    await dialog.getByRole("button", { name: "Reset", exact: true }).click();
    const request = await requestPromise;
    expect(request.postDataJSON()).toEqual({ userId: target.id });
    await expect(
      notifications(page).getByText("Password reset email has been sent. Please check your email", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("#760 H7 H8 H9 H10 H11 H13(P3) C3 C4 C5 C9 C11: deactivate U1, validate reason, reactivate", async ({
    page,
  }) => {
    const target = await resolveU1(page);
    const traffic = new IamTraffic(page);
    const loaded = await openUserDetail(page, target.id);
    assertDummyTarget(loaded, target.email);
    expect(loaded.accountState).toBe("Active");
    const detailUrl = page.url();
    await traffic.waitForQuiet();

    // Step 4: confirm with a double click while the request is held pending (C5).
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let held: Promise<void> | null = null;
    await page.route(DEACTIVATE_URL, (route) => {
      if (route.request().method() !== "POST") return route.fallback();
      held = gate.then(() => route.continue());
      return held;
    });
    await chooseMenuItem(page, "Deactivate account");
    const dialog = deactivateDialog(page);
    await expect(dialog).toBeVisible();
    const mark = traffic.mark();
    const confirm = dialog.getByRole("button", { name: "Deactivate account", exact: true });
    const cancel = dialog.getByRole("button", { name: "Cancel", exact: true });
    const postPromise = page.waitForRequest(
      (request) => DEACTIVATE_URL.test(request.url()) && request.method() === "POST",
    );
    await confirm.dblclick();
    const post = await postPromise;
    await expect(confirm).toBeDisabled();
    await expect(cancel).toBeDisabled();
    await expect(dialog.locator("svg.animate-spin")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.mouse.click(5, 5);
    await expect(dialog).toBeVisible();
    release();
    await held;
    await page.unroute(DEACTIVATE_URL);

    // H7: exactly {"userId": "<U1>"}.
    expect(post.postDataJSON()).toEqual({ userId: target.id });
    // H8
    await expect(
      notifications(page).getByText(STATUS_TEXT.deactivateSuccess, { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(dialog).toBeHidden();
    await expect(statusValue(page)).toHaveText(/^Inactive$/, { timeout: 20_000 });
    expect(page.url()).toBe(detailUrl);
    await traffic.waitForQuiet();
    expectSingleActionTraffic(traffic.since(mark), "deactivate", target.id);

    // C11 + H8: only "Activate account"; opening it sends nothing (H12).
    const menuMark = traffic.mark();
    const menu = await openActionMenu(page);
    expect(await menuStructure(menu)).toEqual(["menuitem:Activate account"]);
    await menu.getByRole("menuitem", { name: "Activate account" }).click();

    // H9: dialog copy, labelled empty reason limited to 500 characters.
    const activate = activateDialog(page);
    await expect(activate).toBeVisible();
    await expect(
      activate.getByText(STATUS_TEXT.activateDescription, { exact: true }),
    ).toBeVisible();
    const reason = activate.getByRole("textbox", { name: "Reason" });
    await expect(reason).toHaveValue("");
    await expect(reason).toHaveAttribute("maxlength", "500");
    await expect(reason).toHaveAttribute("placeholder", STATUS_TEXT.reasonPlaceholder);
    await expect(activate.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
    const submit = activate.getByRole("button", { name: "Activate account", exact: true });
    await expect(submit).toBeVisible();

    // Step 5 / C3: too short, then only spaces.
    await reason.fill("ab");
    await submit.click();
    await expect(activate.getByText(STATUS_TEXT.reasonTooShort, { exact: true })).toBeVisible();
    await expect(activate).toBeVisible();
    await reason.fill("   ");
    await submit.click();
    await expect(activate.getByText(STATUS_TEXT.reasonTooShort, { exact: true })).toBeVisible();
    await expect(activate).toBeVisible();

    // Step 6 / C4: 520 characters inserted, the field keeps 500.
    await reason.fill("");
    await reason.focus();
    await page.keyboard.insertText("x".repeat(520));
    await expect(reason).toHaveValue("x".repeat(500));
    await reason.fill("");

    // C9: cancel sends nothing; reopening shows an empty reason.
    await reason.fill("draft that is cancelled");
    await activate.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(activate).toBeHidden();
    await chooseMenuItem(page, "Activate account");
    await expect(activate).toBeVisible();
    await expect(reason).toHaveValue("");
    await traffic.waitForQuiet();
    const quietCalls = traffic.since(menuMark);
    expect(
      quietCalls,
      `menu, dialog, validation send nothing: ${describeCalls(quietCalls)}`,
    ).toHaveLength(0);

    // Step 7 / H10 H11: reason trimmed, one POST.
    const activateMark = traffic.mark();
    const activatePromise = page.waitForRequest(
      (request) =>
        /\/api\/iam\/users\/activate\/?$/.test(request.url()) && request.method() === "POST",
    );
    await reason.fill("  E2E reinstate ");
    await submit.click();
    const activatePost = await activatePromise;
    expect(activatePost.postDataJSON()).toEqual({ userId: target.id, reason: "E2E reinstate" });
    await expect(
      notifications(page).getByText(STATUS_TEXT.activateSuccess, { exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(activate).toBeHidden();
    await expect(statusValue(page)).toHaveText(/^Active$/, { timeout: 20_000 });
    expect(page.url()).toBe(detailUrl);
    await traffic.waitForQuiet();
    expectSingleActionTraffic(traffic.since(activateMark), "activate", target.id);
    await expectMenuItems(page, ["Reset Password", "Deactivate account"]);
  });

  test("#760 C7: a stale tab activating an already active user shows 'User is already active'", async ({
    page,
  }) => {
    const target = await resolveU1(page);
    const tabB = await page.context().newPage();
    try {
      const loadedA = await openUserDetail(page, target.id);
      await openUserDetail(tabB, target.id);

      await deactivateDummy(page, target, loadedA);
      const staleB = await reloadUserDetail(tabB, target.id);
      expect(staleB.accountState).not.toBe("Active");
      await expect(statusValue(tabB)).toHaveText(/^Inactive$/);

      await activateViaMenu(page, "E2E stale tab setup");

      // Tab B still shows the account deactivated and offers Activate.
      await chooseMenuItem(tabB, "Activate account");
      const dialogB = activateDialog(tabB);
      await expect(dialogB).toBeVisible();
      await dialogB.getByRole("textbox", { name: "Reason" }).fill("stale tab");
      await dialogB.getByRole("button", { name: "Activate account", exact: true }).click();
      await expect(notifications(tabB).getByText("User is already active")).toBeVisible({
        timeout: 20_000,
      });
      await expect(dialogB).toBeHidden();
      await expect(statusValue(tabB)).toHaveText(/^Active$/, { timeout: 20_000 });
      await expectMenuItems(tabB, ["Reset Password", "Deactivate account"]);
    } finally {
      await tabB.close();
    }
  });

  test("#760 H4 H5 C10: a pending invitee offers only Resend Activation, which sends the resend call", async ({
    page,
  }) => {
    const target = await resolveU2(page);
    const traffic = new IamTraffic(page);
    const loaded = await openUserDetail(page, target.id);
    expect(loaded.email).toBe(target.email);
    expect(loaded.accountState).toBe("PendingVerification");
    await traffic.waitForQuiet();
    const mark = traffic.mark();

    const menu = await openActionMenu(page);
    expect(await menuStructure(menu)).toEqual(["menuitem:Resend Activation"]);
    await menu.getByRole("menuitem", { name: "Resend Activation" }).click();
    const dialog = page
      .getByRole("dialog")
      .filter({ has: page.getByRole("heading", { name: "Confirmation" }) });
    await expect(dialog).toBeVisible();
    await traffic.waitForQuiet();
    expect(traffic.since(mark), "opening menu and dialog sends nothing").toHaveLength(0);

    const requestPromise = page.waitForRequest(
      (request) =>
        /\/api\/auth\/resend-activation\/?$/.test(request.url()) && request.method() === "POST",
    );
    await dialog.getByRole("button", { name: "Resend", exact: true }).click();
    const request = await requestPromise;
    // Same body as before the change (fb1ce04f): { userId }.
    expect(request.postDataJSON()).toEqual({ userId: target.id });
    await expect(
      notifications(page).getByText("Activation email has been resent successfully", {
        exact: true,
      }),
    ).toBeVisible({ timeout: 20_000 });
  });

  test("#760 C6 C8: mocked 403 empty, 403 grant body and aborted deactivate keep U1 Active", async ({
    page,
  }) => {
    const target = await resolveU1(page);
    await openUserDetail(page, target.id);

    const cases: {
      name: string;
      toast: string;
      handle: (route: import("@playwright/test").Route) => Promise<void>;
    }[] = [
      {
        name: "403 with an empty body",
        toast: STATUS_TEXT.forbidden,
        handle: (route) => route.fulfill({ status: 403, body: "", headers: corsHeaders(route) }),
      },
      {
        name: "403 with the Access_Grant_Not_Allowed body",
        toast: STATUS_TEXT.forbidden,
        handle: (route) =>
          route.fulfill({
            status: 403,
            contentType: "application/json",
            headers: corsHeaders(route),
            body: JSON.stringify({
              isSuccess: false,
              errors: { Access_Grant_Not_Allowed: "Access_Grant_Not_Allowed" },
            }),
          }),
      },
      {
        name: "request aborted (no response)",
        toast: STATUS_TEXT.somethingWentWrong,
        handle: (route) => route.abort("failed"),
      },
    ];

    for (const mock of cases) {
      await test.step(mock.name, async () => {
        const loaded = await reloadUserDetail(page, target.id);
        assertDummyTarget(loaded, target.email);
        expect(loaded.accountState).toBe("Active");
        await page.route(DEACTIVATE_URL, (route) =>
          route.request().method() === "POST" ? mock.handle(route) : route.fallback(),
        );
        const reread = page.waitForResponse(
          (response) =>
            response.request().method() === "GET" &&
            response.url().split("?")[0].endsWith(`/api/iam/users/${target.id}`),
        );
        await chooseMenuItem(page, "Deactivate account");
        const dialog = deactivateDialog(page);
        await expect(dialog).toBeVisible();
        await dialog.getByRole("button", { name: "Deactivate account", exact: true }).click();
        await expect(notifications(page).getByText(mock.toast, { exact: true })).toBeVisible({
          timeout: 20_000,
        });
        await expect(dialog).toBeHidden();
        await reread;
        await expect(statusValue(page)).toHaveText(/^Active$/);
        await expectMenuItems(page, ["Reset Password", "Deactivate account"]);
        await page.unroute(DEACTIVATE_URL);
      });
    }
  });

  test("#760 H15: screenshot matrix — Active menu and Deactivate dialog", async ({
    page,
  }, testInfo) => {
    const target = await resolveU1(page);
    await openUserDetail(page, target.id);
    for (const viewport of SCREENSHOT_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const theme of SCREENSHOT_THEMES) {
        await applyTheme(page, theme);
        await openActionMenu(page);
        await attachScreenshot(page, testInfo, `h15-1-active-menu-${viewport.name}-${theme}`);
        await actionMenu(page).getByRole("menuitem", { name: "Deactivate account" }).click();
        const dialog = deactivateDialog(page);
        await expect(dialog).toBeVisible();
        await attachScreenshot(page, testInfo, `h15-4-deactivate-dialog-${viewport.name}-${theme}`);
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(dialog).toBeHidden();
      }
    }
    await expect(statusValue(page)).toHaveText(/^Active$/);
  });

  test("#760 H15: screenshot matrix — PendingVerification menu", async ({ page }, testInfo) => {
    const target = await resolveU2(page);
    const loaded = await openUserDetail(page, target.id);
    expect(loaded.accountState).toBe("PendingVerification");
    for (const viewport of SCREENSHOT_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const theme of SCREENSHOT_THEMES) {
        await applyTheme(page, theme);
        await openActionMenu(page);
        await attachScreenshot(page, testInfo, `h15-3-pending-menu-${viewport.name}-${theme}`);
        await closeActionMenu(page);
      }
    }
  });

  test("#760 H15: screenshot matrix — Deactivated menu and Activate dialog error", async ({
    page,
  }, testInfo) => {
    const target = await resolveU1(page);
    const loaded = await openUserDetail(page, target.id);
    await deactivateDummy(page, target, loaded);
    for (const viewport of SCREENSHOT_VIEWPORTS) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      for (const theme of SCREENSHOT_THEMES) {
        await applyTheme(page, theme);
        await openActionMenu(page);
        await attachScreenshot(page, testInfo, `h15-2-deactivated-menu-${viewport.name}-${theme}`);
        await actionMenu(page).getByRole("menuitem", { name: "Activate account" }).click();
        const dialog = activateDialog(page);
        await expect(dialog).toBeVisible();
        await dialog.getByRole("textbox", { name: "Reason" }).fill("ab");
        await dialog.getByRole("button", { name: "Activate account", exact: true }).click();
        await expect(dialog.getByText(STATUS_TEXT.reasonTooShort, { exact: true })).toBeVisible();
        await attachScreenshot(page, testInfo, `h15-5-activate-error-${viewport.name}-${theme}`);
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
        await expect(dialog).toBeHidden();
      }
    }
    await page.setViewportSize(DESKTOP);
    await applyTheme(page, "light");
    await activateViaMenu(page, "E2E screenshot matrix reinstate");
  });

  test("#760 C15: People, Users list and U1's Access, Sessions and History tabs still work", async ({
    page,
  }) => {
    const target = await resolveU1(page);

    await navigateToUsersFlow(page);
    expect(await findUserIdByEmail(page, target.email)).toBe(target.id);

    await openUserDetail(page, target.id);
    await expect(page.getByRole("tab", { name: "Access" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("button", { name: "Manage Roles" })).toBeVisible({
      timeout: 15_000,
    });
    await switchUserTabFlow(page, "Sessions");
    await expect(
      page
        .getByRole("button", { name: "Sign out" })
        .first()
        .or(page.getByText("No sessions").first()),
    ).toBeVisible({ timeout: 15_000 });
    await switchUserTabFlow(page, "History");
    await expect(page.getByRole("tabpanel", { name: /History/i })).toBeVisible();
    await switchUserTabFlow(page, "Access");
    await expect(statusValue(page)).toHaveText(/^Active$/);

    await openProjectOverview(page, "people");
    await expect(page.getByRole("table")).toBeVisible({ timeout: 30_000 });
  });
});

function corsHeaders(route: import("@playwright/test").Route): Record<string, string> {
  const origin = route.request().headers()["origin"] ?? new URL(e2eBaseUrl()).origin;
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-credentials": "true",
  };
}

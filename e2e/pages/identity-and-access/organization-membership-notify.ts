import { expect, type Locator, type Page } from "@playwright/test";
import { escapeForRegex } from "./users";

/**
 * Helpers for the "Notify user by email" choice on organization membership
 * changes. The mail itself is sent by IAM, outside the browser, so these
 * flows assert what the UI asks IAM for: the `notifyUser` flag on the
 * users/access and users/revoke-access requests, and that IAM accepted it.
 */

const USERS_CREATE_URL = /\/api\/iam\/users\/create\/?$/i;
const USERS_ACCESS_URL = /\/api\/iam\/users\/access\/?$/i;
const USERS_REVOKE_URL = /\/api\/iam\/users\/revoke-access\/?$/i;

const NOTIFY_LABEL = "Notify user by email";

type MembershipRequestBody = {
  organizationId?: string;
  notifyUser?: boolean;
};

function notificationsRegion(page: Page) {
  return page.getByRole("region", { name: /Notifications/i });
}

function inviteMemberDialog(page: Page) {
  return page.getByRole("dialog").filter({ hasText: "Invite Member" });
}

/**
 * Clicks `trigger` and returns the JSON body of the POST it fires to `url`,
 * after asserting IAM answered 2xx with isSuccess true.
 */
async function submitAndCaptureBody(
  page: Page,
  trigger: Locator,
  url: RegExp,
): Promise<MembershipRequestBody> {
  const isTarget = (method: string, requestUrl: string) =>
    method === "POST" && url.test(requestUrl);
  const requestPromise = page.waitForRequest((r) => isTarget(r.method(), r.url()), {
    timeout: 20_000,
  });
  const responsePromise = page.waitForResponse((r) => isTarget(r.request().method(), r.url()), {
    timeout: 20_000,
  });

  await trigger.click();

  const request = await requestPromise;
  const response = await responsePromise;
  expect(response.status(), `${request.url()} answered HTTP ${response.status()}`).toBeLessThan(
    400,
  );
  const responseBody = (await response.json().catch(() => null)) as {
    isSuccess?: boolean;
    errors?: unknown;
  } | null;
  expect(
    responseBody?.isSuccess,
    `${request.url()} returned isSuccess=false: ${JSON.stringify(responseBody?.errors ?? responseBody)}`,
  ).toBe(true);

  return (request.postDataJSON() ?? {}) as MembershipRequestBody;
}

async function openInviteMemberDialog(page: Page, email: string) {
  const membersTab = page.getByRole("tab", { name: /Members/ }).first();
  await membersTab.click();
  await expect(membersTab).toHaveAttribute("data-state", "active");
  await page
    .getByRole("button", { name: /Invite Member/i })
    .first()
    .click();

  const dialog = inviteMemberDialog(page);
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await dialog.getByPlaceholder("name@company.com").fill(email);
  return dialog;
}

/** The org combobox preselects the org being viewed; pick it explicitly if not. */
async function ensureInviteOrganization(page: Page, dialog: Locator, organizationName: string) {
  const orgTrigger = dialog.getByRole("combobox");
  await expect(orgTrigger).toBeVisible({ timeout: 10_000 });
  if (await orgTrigger.getByText(organizationName, { exact: true }).isVisible()) return;

  await orgTrigger.click();
  const search = page.getByPlaceholder("Search organizations...");
  if (await search.isVisible({ timeout: 3_000 })) {
    await search.fill(organizationName);
  }
  await page.getByRole("option", { name: organizationName, exact: true }).click();
}

/**
 * Invites an email that has no account yet. A new account always receives its
 * activation mail, so the dialog must not offer the notify choice.
 */
export async function inviteNewMemberHidesNotifyFlow(
  page: Page,
  email: string,
  organizationName: string,
) {
  const dialog = await openInviteMemberDialog(page, email);
  await ensureInviteOrganization(page, dialog, organizationName);

  const sendButton = dialog.getByRole("button", { name: "Send invite" });
  await expect(sendButton).toBeEnabled({ timeout: 15_000 });
  await expect(dialog.getByRole("checkbox", { name: NOTIFY_LABEL })).toHaveCount(0);

  await submitAndCaptureBody(page, sendButton, USERS_CREATE_URL);
  await expect(notificationsRegion(page).getByText("Invitation is sent")).toBeVisible({
    timeout: 15_000,
  });
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

/**
 * Adds an email that already has an account to the organization being viewed.
 * The notify box is offered and ticked by default; `notify` decides whether it
 * is left ticked. Asserts the users/access body carries that choice.
 */
export async function grantExistingMemberFlow(
  page: Page,
  email: string,
  organizationName: string,
  notify: boolean,
) {
  const dialog = await openInviteMemberDialog(page, email);
  await ensureInviteOrganization(page, dialog, organizationName);

  const grantButton = dialog.getByRole("button", { name: "Grant access" });
  await expect(grantButton).toBeEnabled({ timeout: 20_000 });

  const notifyBox = dialog.getByRole("checkbox", { name: NOTIFY_LABEL });
  await expect(notifyBox).toBeVisible();
  await expect(notifyBox).toHaveAttribute("data-state", "checked");
  if (!notify) {
    await notifyBox.click();
    await expect(notifyBox).toHaveAttribute("data-state", "unchecked");
  }

  const body = await submitAndCaptureBody(page, grantButton, USERS_ACCESS_URL);
  expect(body.notifyUser).toBe(notify);

  await expect(
    notificationsRegion(page).getByText("User granted access to the organization"),
  ).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

function memberRow(page: Page, email: string) {
  return page
    .getByRole("button")
    .filter({ hasText: new RegExp(escapeForRegex(email), "i") })
    .first();
}

/** Waits for `email` to appear in the Members tab, reloading once if the list is stale. */
async function expectMemberListed(page: Page, email: string) {
  const row = memberRow(page, email);
  if (await row.isVisible({ timeout: 15_000 })) return row;

  await page.reload({ waitUntil: "domcontentloaded" });
  const membersTab = page.getByRole("tab", { name: /Members/ }).first();
  await membersTab.click();
  await expect(row).toBeVisible({ timeout: 20_000 });
  return row;
}

/**
 * Revokes `email` from the organization being viewed, from its Members tab.
 * The notify box is ticked by default; `notify` decides whether it stays so.
 */
export async function revokeMemberFromOrganizationFlow(page: Page, email: string, notify: boolean) {
  const membersTab = page.getByRole("tab", { name: /Members/ }).first();
  await membersTab.click();
  await expect(membersTab).toHaveAttribute("data-state", "active");

  const row = await expectMemberListed(page, email);
  // The row renders a mobile and a desktop revoke button; only one is shown.
  await row.locator('button[aria-label="Revoke from organization"]:visible').first().click();

  const dialog = page.getByRole("dialog").filter({ hasText: "Revoke access" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });

  const notifyBox = dialog.getByRole("checkbox", { name: NOTIFY_LABEL });
  await expect(notifyBox).toHaveAttribute("data-state", "checked");
  if (!notify) {
    await notifyBox.click();
    await expect(notifyBox).toHaveAttribute("data-state", "unchecked");
  }

  const body = await submitAndCaptureBody(
    page,
    dialog.getByRole("button", { name: "Revoke", exact: true }),
    USERS_REVOKE_URL,
  );
  expect(body.notifyUser).toBe(notify);

  await expect(
    notificationsRegion(page).getByText(
      new RegExp(`${escapeForRegex(email)} has been revoked`, "i"),
    ),
  ).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

/** Opens the member's user detail page from the organization's Members tab. */
export async function openMemberDetailFlow(page: Page, email: string) {
  const membersTab = page.getByRole("tab", { name: /Members/ }).first();
  await membersTab.click();
  const row = await expectMemberListed(page, email);
  await row.locator("p").first().click();
  await expect(page).toHaveURL(/\/iam\/user-detail\/.+/, { timeout: 15_000 });
  await expect(page.getByRole("tab", { name: "Access" })).toBeVisible({ timeout: 15_000 });
}

/**
 * On the user detail Access tab, removes the user from `organizationName`
 * through the Remove organization membership dialog, leaving the notify box
 * at its default (ticked).
 */
export async function removeMembershipFromUserDetailFlow(page: Page, organizationName: string) {
  const accessTab = page.getByRole("tab", { name: "Access" });
  await accessTab.click();
  await expect(accessTab).toHaveAttribute("aria-selected", "true");

  const orgSelect = page.locator("#access-org-select");
  await expect(orgSelect).toBeVisible({ timeout: 20_000 });
  if (!(await orgSelect.getByText(organizationName, { exact: true }).isVisible())) {
    await orgSelect.click();
    await page.getByRole("option").filter({ hasText: organizationName }).first().click();
  }

  await page.getByRole("button", { name: `Revoke user's access from ${organizationName}` }).click();

  const dialog = page.getByRole("dialog").filter({ hasText: "Remove organization membership" });
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.getByRole("checkbox", { name: NOTIFY_LABEL })).toHaveAttribute(
    "data-state",
    "checked",
  );

  const body = await submitAndCaptureBody(
    page,
    dialog.getByRole("button", { name: "Remove", exact: true }),
    USERS_REVOKE_URL,
  );
  expect(body.notifyUser).toBe(true);

  await expect(
    notificationsRegion(page).getByText("Organization membership removed successfully"),
  ).toBeVisible({ timeout: 15_000 });
  await expect(dialog).toBeHidden({ timeout: 15_000 });
}

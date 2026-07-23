import { expect, type Page } from "@playwright/test";

// Navigation helpers for the sidebar product groups defined in
// client/app/constants/navigation-menus.ts. These specs do NOT depend on the
// [setup] project — they reuse the storageState at fixtures/auth.json.

const username = process.env.E2E_USERNAME;
const password = process.env.E2E_PASSWORD;

/**
 * Perform the real OIDC login flow against the deployed IAM host.
 *
 * The standard [setup] project already does this and writes
 * fixtures/auth.json; callers that bypass [setup] (see
 * playwright.skip-setup.config.ts) must invoke this themselves. To keep the
 * call sites simple, callers should normally just rely on storageState — this
 * helper exists for ad-hoc / headed debugging sessions.
 *
 * When storageState already carries an authenticated session (no Log in CTA on
 * the landing page), this short-circuits to the console without re-running
 * OIDC. The IAM OIDC login page is currently broken on the deployed host (it
 * hangs after credential submission), so prefer the storageState path.
 */
export async function loginFresh(page: Page): Promise<void> {
  if (!username || !password) {
    throw new Error(
      "E2E_USERNAME / E2E_PASSWORD are not set. Fill them in e2e/.env.e2e.",
    );
  }

  // Probe the landing page first — if storageState is already authenticated
  // we land directly on the console and skip the whole IAM dance.
  await page.goto("/app/console");
  if (/\/app\/console/.test(page.url())) return;

  await page.goto("/login");
  const loginButton = page.getByRole("button", { name: "Log in to your account" });
  if (!(await loginButton.isVisible().catch(() => false))) {
    // Already authenticated but landed somewhere unexpected — let the caller
    // assert against the actual URL.
    return;
  }

  await loginButton.click();

  const emailField = page.locator("#oidc-email");
  await emailField.waitFor({ timeout: 30_000 });
  await emailField.fill(username);
  await page.locator("#oidc-password").fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();

  await page.waitForURL("**/app/console", { timeout: 60_000 });
  await expect(page).toHaveURL(/\/app\/console/);
}

/**
 * Land on the console (/app/console) and wait for the page to settle.
 * The kit's ConsolePage renders either "Welcome to SELISE Blocks" (empty
 * account) or "Your Blocks Projects" (≥ 1 project). We don't pin a specific
 * heading because both branches are valid landing states.
 */
export async function enterConsole(page: Page): Promise<void> {
  await page.goto("/app/console");
  await page.waitForURL(/\/app\/console(\/|$)/, { timeout: 30_000 });
  await expect(page.locator("main")).toBeVisible({ timeout: 30_000 });
}

/**
 * Open a top-level sidebar group by visible name and wait for its expanded
 * child items. The sidebar uses accordion semantics — clicking the parent
 * triggers navigation to its `path` and reveals `children`.
 *
 * `childLabel` is optional: when provided, the function asserts the named
 * child is visible after the parent is opened.
 */
export async function openSidebarItem(
  page: Page,
  parentLabel: string,
  childLabel?: string,
): Promise<void> {
  const parent = page
    .getByRole("link", { name: parentLabel })
    .or(page.getByRole("button", { name: parentLabel }))
    .first();

  await expect(
    parent,
    `sidebar item "${parentLabel}" not visible`,
  ).toBeVisible({ timeout: 30_000 });
  await parent.click();

  if (childLabel) {
    const child = page
      .getByRole("link", { name: childLabel })
      .or(page.getByRole("button", { name: childLabel }))
      .first();
    await expect(
      child,
      `sidebar child "${childLabel}" not visible after opening "${parentLabel}"`,
    ).toBeVisible({ timeout: 30_000 });
  }
}

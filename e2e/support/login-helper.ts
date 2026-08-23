import { expect, type Page } from "@playwright/test";
import { e2eBaseUrl, e2eCredentials } from "./env";

/** Dev-IAM OIDC login fields — ids on some builds, labels on others. */
function oidcEmailField(page: Page) {
  return page.locator("#oidc-email").or(page.getByRole("textbox", { name: "Work Email" }));
}

function oidcPasswordField(page: Page) {
  return page.locator("#oidc-password").or(page.getByRole("textbox", { name: "Password" }));
}

const consoleHeading = (page: Page) =>
  page.getByRole("heading", {
    name: /Your Blocks Projects|Welcome to SELISE Blocks/,
  });

async function fillCredentialsAndSubmit(page: Page) {
  const { email, password } = e2eCredentials();
  const emailField = oidcEmailField(page);
  await emailField.fill(email);
  const passwordField = oidcPasswordField(page);
  await expect(passwordField).toBeVisible({ timeout: 10_000 });
  await passwordField.fill(password);
  await page.getByRole("button", { name: "Login", exact: true }).click();
}

/**
 * A session that's actually still valid makes /login (or the "Log in to your
 * account" click) redirect straight back to /app/console instead of ever
 * settling on the OIDC form — so a plain "wait for the button, click it,
 * wait for the email field" sequence can end up retrying a click against an
 * element that keeps appearing and disappearing as that redirect loops,
 * until it times out. Race each stage against the console heading / a
 * redirect to /app/console instead, so a session that turns out to already
 * be valid is recognized and short-circuits immediately.
 */
export async function loginThroughOidc(page: Page, options?: { loginPath?: string }) {
  const loginPath = options?.loginPath ?? "/login";

  await page.goto(loginPath, { waitUntil: "domcontentloaded" });

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await consoleHeading(page).isVisible({ timeout: 3_000 }).catch(() => false)) {
      return;
    }

    const loginButton = page.getByRole("button", { name: "Log in to your account" });
    if (await loginButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      try {
        await loginButton.click({ timeout: 8_000 });
      } catch {
        if (await consoleHeading(page).isVisible({ timeout: 3_000 }).catch(() => false)) return;
        await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" });
        continue;
      }

      const emailField = oidcEmailField(page);
      await Promise.race([
        emailField.waitFor({ state: "visible", timeout: 30_000 }),
        consoleHeading(page).waitFor({ state: "visible", timeout: 30_000 }),
        page.waitForURL(/\/app\/console/, { timeout: 30_000 }),
      ]).catch(() => {});

      if (await consoleHeading(page).isVisible().catch(() => false)) {
        return;
      }

      if (await emailField.isVisible().catch(() => false)) {
        await fillCredentialsAndSubmit(page);
        await page.waitForURL(/\/app\/console/, { timeout: 45_000 });
        return;
      }

      await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" });
      continue;
    }

    await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" });
  }

  await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" });
  await expect(consoleHeading(page)).toBeVisible({ timeout: 30_000 });
}

/** Reuse saved storage state; fall back to OIDC only when the session expired. */
export async function ensureAuthenticated(page: Page) {
  await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" });

  if (await consoleHeading(page).isVisible({ timeout: 15_000 }).catch(() => false)) {
    return;
  }

  await loginThroughOidc(page);
}

/** Force a full OIDC login (ignores any saved session). */
export async function loginFresh(page: Page) {
  await loginThroughOidc(page, { loginPath: e2eBaseUrl() });
}

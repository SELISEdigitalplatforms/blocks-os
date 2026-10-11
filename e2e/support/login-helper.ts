import { expect, type Page } from "@playwright/test"
import { e2eBaseUrl, e2eCredentials } from "./env"

/** Dev-IAM OIDC login fields — ids on some builds, labels on others. */
function oidcEmailField(page: Page) {
  return page.locator("#oidc-email").or(page.getByRole("textbox", { name: "Work Email" }))
}

function oidcPasswordField(page: Page) {
  return page.locator("#oidc-password").or(page.getByRole("textbox", { name: "Password" }))
}

// Empty-console "Welcome to SELISE Blocks" is also shown before OIDC completes
// on preview, so it must NOT count as authenticated. Prefer the projects list
// heading, or the signed-in user menu.
const consoleHeading = (page: Page) =>
  page.getByRole("heading", { name: /Your Blocks Projects/i })

const signedInChrome = (page: Page) =>
  page.getByRole("button", { name: /Open user menu|User menu/i })

async function isAuthenticatedConsole(page: Page): Promise<boolean> {
  if (await consoleHeading(page).isVisible({ timeout: 1_500 }).catch(() => false)) return true
  if (await signedInChrome(page).isVisible({ timeout: 1_500 }).catch(() => false)) return true
  return false
}

/** True when the page is the product login gate or OIDC credential form. */
export async function isLoginSurface(page: Page): Promise<boolean> {
  if (
    await page
      .getByRole("button", { name: "Log in to your account" })
      .isVisible({ timeout: 500 })
      .catch(() => false)
  ) {
    return true
  }

  if (await oidcEmailField(page).isVisible({ timeout: 500 }).catch(() => false)) {
    return true
  }

  try {
    if (/\/login\/?$/i.test(new URL(page.url()).pathname)) return true
  } catch {
    // ignore invalid URL
  }

  return false
}

/**
 * page.goto that tolerates the app's own post-login redirects. Right after the
 * OIDC callback the SPA still navigates (/login -> /app/console, or a silent
 * /api/oidc/authorize round trip when a project opens), and Playwright reports
 * the competing navigation as net::ERR_ABORTED. Let the app settle, then retry.
 */
export async function gotoSettled(page: Page, url: string, attempts = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await page.goto(url, { waitUntil: "domcontentloaded" })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const interrupted = /ERR_ABORTED|interrupted by another navigation|NS_BINDING_ABORTED/i.test(
        message,
      )
      if (!interrupted || attempt >= attempts) throw error
      await page.waitForLoadState("domcontentloaded").catch(() => {})
      await page.waitForTimeout(1_000 * attempt)
    }
  }
}

async function fillCredentialsAndSubmit(page: Page) {
  const { email, password } = e2eCredentials()
  const emailField = oidcEmailField(page)
  await emailField.fill(email)
  const passwordField = oidcPasswordField(page)
  await expect(passwordField).toBeVisible({ timeout: 10_000 })
  await passwordField.fill(password)
  await page.getByRole("button", { name: "Login", exact: true }).click()
}

export async function loginThroughOidc(page: Page, options?: { loginPath?: string }) {
  const base = e2eBaseUrl()
  const loginPath = options?.loginPath ?? `${base}/login`

  await gotoSettled(page, loginPath)

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await isAuthenticatedConsole(page)) {
      return
    }

    const loginButton = page.getByRole("button", { name: "Log in to your account" })
    if (await loginButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
      try {
        await loginButton.click({ timeout: 8_000 })
      } catch {
        if (await isAuthenticatedConsole(page)) return
        await gotoSettled(page, `${base}/app/console`)
        continue
      }

      const emailField = oidcEmailField(page)
      await Promise.race([
        emailField.waitFor({ state: "visible", timeout: 30_000 }),
        consoleHeading(page).waitFor({ state: "visible", timeout: 30_000 }),
        page.waitForURL(/\/app\/console/, { timeout: 30_000 }),
      ]).catch(() => {})

      if (await isAuthenticatedConsole(page)) {
        return
      }

      if (await emailField.isVisible().catch(() => false)) {
        await fillCredentialsAndSubmit(page)
        await page.waitForURL(/\/app\/console/, { timeout: 45_000 })
        return
      }

      await gotoSettled(page, `${base}/app/console`)
      continue
    }

    await gotoSettled(page, `${base}/app/console`)
  }

  await gotoSettled(page, `${base}/app/console`)
  await expect(signedInChrome(page).or(consoleHeading(page)).first()).toBeVisible({ timeout: 30_000 })
}

/**
 * Land on the OS console; re-run OIDC when the saved session expired.
 * Idempotent when already authenticated.
 */
export async function ensureAuthenticated(page: Page) {
  const base = e2eBaseUrl()
  await gotoSettled(page, `${base}/app/console`)

  if (await isAuthenticatedConsole(page)) {
    return
  }

  await loginThroughOidc(page)
  await expect(signedInChrome(page).or(consoleHeading(page)).first()).toBeVisible({ timeout: 30_000 })
}

/** Force a full OIDC login (ignores any saved session). */
export async function loginFresh(page: Page) {
  await loginThroughOidc(page, { loginPath: e2eBaseUrl() })
}

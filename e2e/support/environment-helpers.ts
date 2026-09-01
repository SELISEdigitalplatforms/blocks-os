import { expect, type Page } from "@playwright/test"
import { openProjectOverview } from "./os-helpers"
import { ensureAuthenticated, isLoginSurface } from "./login-helper"
import { refreshSuiteSession } from "./session-lifecycle"

export function environmentCard(page: Page, label: string) {
  return page
    .locator('[class*="cursor-pointer"]')
    .filter({ has: page.getByText(label, { exact: true }) })
    .filter({ hasText: "X-Blocks-Key:" })
    .first()
}

function isEnvironmentsListUrl(page: Page): boolean {
  try {
    return /\/app\/project\/[^/]+\/environments\/?$/i.test(new URL(page.url()).pathname)
  } catch {
    return false
  }
}

function isEnvDashboardUrl(page: Page): boolean {
  try {
    return /\/app\/(?!project\/)[^/]+\/dashboard\/?$/i.test(new URL(page.url()).pathname)
  } catch {
    return false
  }
}

function isConsoleUrl(page: Page): boolean {
  try {
    return /\/app\/console\/?$/i.test(new URL(page.url()).pathname)
  } catch {
    return false
  }
}

/** Environments list finished loading (survives post-mutation refetch skeleton). */
export async function waitForEnvironmentsListReady(page: Page) {
  await expect(page).toHaveURL(/\/app\/project\/[^/]+\/environments\/?$/, { timeout: 30_000 })
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
    timeout: 60_000,
  })
  await expect(page.getByText("X-Blocks-Key:").first()).toBeVisible({ timeout: 30_000 })
}

async function ensureEnvironmentsList(page: Page) {
  if (!isEnvironmentsListUrl(page) || isConsoleUrl(page)) {
    await openProjectOverview(page, "environments")
  }
  await waitForEnvironmentsListReady(page)
}

/**
 * Click an environment card on the Environments list and land on its dashboard.
 * Recovers if impersonation/navigation bounces to /app/console.
 */
export async function openEnvironmentCardDashboard(page: Page, label = "Development") {
  await ensureEnvironmentsList(page)

  const card = environmentCard(page, label)
  await expect(card).toBeVisible({ timeout: 15_000 })

  const setupPending = card.locator('[aria-label="Setup pending"]')
  if (await setupPending.isVisible({ timeout: 3000 }).catch(() => false)) {
    const repairButton = card.locator('[aria-label="Repair environment"]')
    if (await repairButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await repairButton.click()
      await page.getByRole("button", { name: "Repair" }).last().click()
      await expect(setupPending).toHaveCount(0, { timeout: 60_000 })
      await ensureEnvironmentsList(page)
    } else {
      return
    }
  }

  const maxAttempts = 3

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await ensureEnvironmentsList(page)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await card.click({ force: true })

    try {
      // The suite session can expire mid-click: the card navigation bounces
      // through /login (sometimes twice) before settling on /app/console.
      await page.waitForURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 25_000 })
      return
    } catch (error) {
      if (isEnvDashboardUrl(page)) {
        return
      }
      if (await isLoginSurface(page)) {
        // Genuinely stuck on the login page — the app's own guard hasn't
        // bounced us onward yet.
        await ensureAuthenticated(page)
      } else if (isConsoleUrl(page)) {
        // The click bounced through /login and back to /app/console, and the
        // console heading renders fine there — ensureAuthenticated() checks
        // exactly that heading and no-ops the instant it's visible, so it
        // never actually re-authenticates in this state. That auto-bounce is
        // the symptom of a stale/degraded access token (the app's own silent
        // refresh is broken — see session-lifecycle.ts), not something a
        // "does the console look loaded" check can detect. Force a real OIDC
        // login instead, or every retry clicks with the same bad token and
        // fails identically.
        await refreshSuiteSession(page)
      }
      if (attempt === maxAttempts - 1) {
        throw error
      }
      // Console bounce or stuck mid-nav — recover Environments list and retry.
    }
  }
}

import fs from "fs"
import path from "path"
import type { Page } from "@playwright/test"
import { openNamedProjectDashboard } from "./create-and-delete-project"
import { loginFresh } from "./login-helper"
import { canonicalDashboardUrl } from "./navigation"
import { OS_SESSION_PATH, readOsProject } from "./os-project"

/**
 * The app's own silent token refresh is broken: the shared HttpClient
 * (@seliseblocks/genesis-os) posts a hardcoded refresh_token, so refresh
 * always fails server-side and the app hard-redirects to /login, wiping all
 * client state. That's a product bug, not fixable from here (external
 * package, no local source).
 *
 * A long serial "os" suite run (~25 spec files) reliably outlives the access
 * token, so instead of leaning on the app's refresh, the suite refreshes its
 * own saved session on a wall-clock timer: a real, full OIDC login well
 * before the token would expire, run between tests. This keeps every test's
 * storageState valid without ever exercising the broken refresh path, and is
 * independent from (and a backstop for) the reactive isLoginSurface recovery
 * already used in os-helpers.ts / people-helpers.ts / environment-helpers.ts
 * for the rare case a token expires mid-test despite this.
 */
const SESSION_META_PATH = path.resolve(__dirname, "../fixtures/os-session-meta.json")

// 3 minutes. The dev access token lives 300 s and the app's own silent refresh
// cannot renew it (genesis-os posts a hardcoded empty refresh_token, see the
// comment above), so every 401 is terminal for the request that hit it. At 10
// and then 5 minutes, tests still started with seconds left on the token and
// hit a 401 or the sign-in page mid-test (organizations, environments, people,
// the Logs reload step). Shrinking the window is the only lever on the test side.
const DEFAULT_REFRESH_INTERVAL_MS = 180_000

function refreshIntervalMs(): number {
  const configured = Number(process.env.E2E_SESSION_REFRESH_INTERVAL_MS)
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_REFRESH_INTERVAL_MS
}

type SessionMeta = { refreshedAt: number }

function readSessionMeta(): SessionMeta | null {
  if (!fs.existsSync(SESSION_META_PATH)) return null
  try {
    const parsed = JSON.parse(fs.readFileSync(SESSION_META_PATH, "utf8")) as Partial<SessionMeta>
    return typeof parsed.refreshedAt === "number" ? { refreshedAt: parsed.refreshedAt } : null
  } catch {
    return null
  }
}

function writeSessionMeta(meta: SessionMeta) {
  fs.mkdirSync(path.dirname(SESSION_META_PATH), { recursive: true })
  fs.writeFileSync(SESSION_META_PATH, JSON.stringify(meta, null, 2))
}

async function persistSuiteSession(page: Page) {
  fs.mkdirSync(path.dirname(OS_SESSION_PATH), { recursive: true })
  await page.context().storageState({ path: OS_SESSION_PATH })
}

/** Call right after any fresh login + session save (suite setup, or a refresh below). */
export function resetSessionRefreshClock() {
  writeSessionMeta({ refreshedAt: Date.now() })
}

export function isSuiteSessionStale(): boolean {
  const meta = readSessionMeta()
  if (!meta) return true
  return Date.now() - meta.refreshedAt >= refreshIntervalMs()
}

/**
 * Force a fresh, real OIDC login and reseed the shared project's localStorage
 * state, regardless of whether the current session still looks valid. Safe
 * to call between tests — it's a normal navigation, not a retry of whatever
 * the previous test was doing.
 */
export async function refreshSuiteSession(page: Page): Promise<void> {
  const fixture = readOsProject()
  if (!fixture?.projectName) return // os-setup hasn't run yet — nothing to reseed against

  await loginFresh(page)
  await openNamedProjectDashboard(page, fixture.projectName, {
    dashboardUrl: canonicalDashboardUrl(fixture),
  })
  await persistSuiteSession(page)
  resetSessionRefreshClock()
}

export async function refreshSuiteSessionIfStale(page: Page): Promise<void> {
  if (!isSuiteSessionStale()) return
  await refreshSuiteSession(page)
}

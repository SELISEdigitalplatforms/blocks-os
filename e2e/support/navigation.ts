import dns from "node:dns/promises"
import { type Page } from "@playwright/test"
import { e2eBaseUrl } from "./env"

export function buildProjectRouteUrl(itemId: string, route: string): string {
  const normalizedRoute = route.replace(/^\//, "")
  return `${e2eBaseUrl()}/app/${itemId}/${normalizedRoute}`
}

export function canonicalDashboardUrl(fixture: { itemId: string }): string {
  return buildProjectRouteUrl(fixture.itemId, "dashboard")
}

/** Rewrite a stored absolute URL to use the current `E2E_BASE_URL` origin. */
export function resolveE2eUrl(urlOrPath: string): string {
  try {
    const parsed = new URL(urlOrPath)
    const origin = new URL(e2eBaseUrl()).origin
    return `${origin}${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    if (urlOrPath.startsWith("/")) {
      return `${e2eBaseUrl()}${urlOrPath}`
    }
    return urlOrPath
  }
}

function formatDnsHelp(hostname: string): string {
  return (
    `Host "${hostname}" is not resolvable. ` +
    `Set E2E_BASE_URL in e2e/.env.e2e to a reachable target. ` +
    `For local runs with a named domain, add to /etc/hosts: 127.0.0.1 ${hostname} ` +
    `(see e2e/.env.e2e.example).`
  )
}

/** Fail fast before the suite when the configured host cannot be resolved. */
export async function assertE2eHostResolvable(): Promise<void> {
  const hostname = new URL(e2eBaseUrl()).hostname
  try {
    await dns.lookup(hostname)
  } catch {
    throw new Error(formatDnsHelp(hostname))
  }
}

const NAV_TIMEOUT_MS = 45_000
const SHELL_PAINT_TIMEOUT_MS = 15_000

/**
 * Did *anything* render after this navigation? A hard goto to a live prod
 * target can complete "domcontentloaded" while the SPA itself stalls (a slow
 * bundle/API call on a cold deep link) and paints nothing — the page stays
 * blank white until a much later, unrelated assertion times out. The Logo
 * image is present on every page state this app renders (login, marketing,
 * authenticated console/app), so its visibility is a cheap "shell painted"
 * signal independent of which page we ended up on.
 */
async function waitForAppShell(page: Page, timeout: number): Promise<boolean> {
  return page
    .locator('img[alt="Logo"]')
    .first()
    .waitFor({ state: "visible", timeout })
    .then(() => true)
    .catch(() => false)
}

/**
 * Navigate with a bounded timeout instead of Playwright's unlimited default.
 * Against a live target, a navigation can stall on real network/backend
 * latency; without a timeout that stall silently eats the whole test's
 * budget (observed: a single hung goto exhausting a 180s test timeout)
 * instead of failing fast. Retries once — most stalls here are transient —
 * before surfacing the error, and after a completed navigation also retries
 * once if the app shell never paints (blank page, see waitForAppShell).
 */
export async function gotoE2e(
  page: Page,
  url: string,
  options?: Parameters<Page["goto"]>[1],
) {
  const target = resolveE2eUrl(url)
  const maxAttempts = 2

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      await page.goto(target, {
        waitUntil: "domcontentloaded",
        timeout: NAV_TIMEOUT_MS,
        ...options,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|ERR_CONNECTION_REFUSED/i.test(message)) {
        const hostname = new URL(target).hostname
        throw new Error(`${formatDnsHelp(hostname)} Original: ${message}`, { cause: error })
      }
      if (attempt === maxAttempts - 1) throw error
      continue // stalled/timed-out navigation — retry instead of burning the test budget
    }

    if (await waitForAppShell(page, SHELL_PAINT_TIMEOUT_MS)) return
    if (attempt === maxAttempts - 1) return // let the caller's own assertions report the failure
    // Navigation completed but the app never painted — retry the goto once.
  }
}

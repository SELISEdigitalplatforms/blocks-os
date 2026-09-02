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

export async function gotoE2e(
  page: Page,
  url: string,
  options?: Parameters<Page["goto"]>[1],
) {
  const target = resolveE2eUrl(url)

  try {
    await page.goto(target, { waitUntil: "domcontentloaded", ...options })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|ERR_CONNECTION_REFUSED/i.test(message)) {
      const hostname = new URL(target).hostname
      throw new Error(`${formatDnsHelp(hostname)} Original: ${message}`, { cause: error })
    }
    throw error
  }
}

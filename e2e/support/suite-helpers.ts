import fs from "fs"
import path from "path"
import { type Page } from "@playwright/test"
import {
  openNamedProjectDashboard,
  waitForOsDashboardReady,
} from "./create-and-delete-project"
import { ensureAuthenticated, isLoginSurface } from "./login-helper"
import { buildProjectRouteUrl, canonicalDashboardUrl, gotoE2e } from "./navigation"
import { OS_SESSION_PATH, readOsProject } from "./os-project"

async function persistSuiteSession(page: Page) {
  fs.mkdirSync(path.dirname(OS_SESSION_PATH), { recursive: true })
  await page.context().storageState({ path: OS_SESSION_PATH })
}

async function reseedProjectContext(
  page: Page,
  projectName: string,
  dashboardUrl: string | undefined,
) {
  await openNamedProjectDashboard(page, projectName, { dashboardUrl })
  await persistSuiteSession(page)
}

/**
 * Open the shared suite project dashboard via direct URL on Blocks OS.
 *
 * Project create/reuse happens natively on OS in suite setup — no cross-app hop.
 */
export async function openSharedProjectDashboard(page: Page) {
  const fixture = readOsProject()
  if (!fixture?.itemId) {
    throw new Error(
      "Missing fixtures/os-project.json (or itemId) — run the os-setup project first " +
        "(suite.setup.spec.ts).",
    )
  }

  const targetUrl = buildProjectRouteUrl(fixture.itemId, "dashboard")
  const fixtureDashboardUrl = canonicalDashboardUrl(fixture)

  await gotoE2e(page, targetUrl)

  if (await isLoginSurface(page)) {
    await ensureAuthenticated(page)
    await reseedProjectContext(page, fixture.projectName, fixtureDashboardUrl)
    return
  }

  try {
    await waitForOsDashboardReady(page, fixture.projectName)
    await persistSuiteSession(page)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const bouncedToConsole = /landed on the console/i.test(message)

    let pathname = ""
    try {
      pathname = new URL(page.url()).pathname
    } catch {
      pathname = ""
    }

    if (!bouncedToConsole && !/\/app\/console\/?$/i.test(pathname)) {
      throw error
    }

    await reseedProjectContext(page, fixture.projectName, fixtureDashboardUrl)
  }
}

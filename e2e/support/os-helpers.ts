import fs from "fs"
import path from "path"
import { expect, type Page } from "@playwright/test"
import { openNamedProjectDashboard } from "./create-and-delete-project"
import { ensureAuthenticated, isLoginSurface } from "./login-helper"
import {
  buildProjectRouteUrl,
  canonicalDashboardUrl,
  gotoE2e,
} from "./navigation"
import { e2eBaseUrl } from "./env"
import { OS_SESSION_PATH, readOsProject } from "./os-project"
import { openSharedProjectDashboard } from "./suite-helpers"

/**
 * OS in-app routes:
 * - Overview → /app/{itemId}/dashboard
 * - IAM → /app/{itemId}/iam/{subpath}
 * - Secret management → /app/{itemId}/secret-management/{subpath}
 * - Logs & traces → /app/{itemId}/lmt/{subpath}
 * - Email → /app/{itemId}/email-management
 * - Project overview → /app/project/{tenantGroupId}/{subpath}
 */
export { buildProjectRouteUrl, canonicalDashboardUrl } from "./navigation"

async function persistSuiteSession(page: Page) {
  fs.mkdirSync(path.dirname(OS_SESSION_PATH), { recursive: true })
  await page.context().storageState({ path: OS_SESSION_PATH })
}

async function reseedThenGoto(
  page: Page,
  targetUrl: string,
  projectName: string,
  dashboardUrl?: string,
) {
  await openNamedProjectDashboard(page, projectName, { dashboardUrl })
  await persistSuiteSession(page)
  await gotoE2e(page, targetUrl)
}

function requireFixture() {
  const fixture = readOsProject()
  if (!fixture?.itemId) {
    throw new Error(
      "Missing fixtures/os-project.json — run os-setup first (suite.setup.spec.ts).",
    )
  }
  return fixture
}

async function gotoItemRoute(page: Page, route: string, ready?: { heading: string | RegExp }) {
  const fixture = requireFixture()
  const targetUrl = buildProjectRouteUrl(fixture.itemId, route)
  const dashboardUrl = canonicalDashboardUrl(fixture)

  await gotoE2e(page, targetUrl)

  if (await isLoginSurface(page)) {
    await ensureAuthenticated(page)
    await reseedThenGoto(page, targetUrl, fixture.projectName, dashboardUrl)
  } else if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
    await reseedThenGoto(page, targetUrl, fixture.projectName, dashboardUrl)
  }

  if (ready) {
    // exact: true — Playwright's default name match is substring/case-insensitive,
    // so a route heading like "Captcha" also matches a "Google reCAPTCHA" card
    // heading once one exists on the project ("reCAPTCHA" contains "Captcha"),
    // hitting a strict-mode violation. The page-level heading should match exactly.
    await expect(page.getByRole("heading", { name: ready.heading, exact: true })).toBeVisible({
      timeout: 30_000,
    })
  }

  await persistSuiteSession(page)
  return fixture
}

export async function openOsConsole(page: Page) {
  await ensureAuthenticated(page)
  await expect(
    page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
  ).toBeVisible({ timeout: 30_000 })
}

export async function openOsDashboard(page: Page) {
  await openSharedProjectDashboard(page)
}

const PROJECT_OVERVIEW_HEADING: Record<
  "people" | "settings" | "repositories" | "environments",
  string
> = {
  people: "People",
  settings: "Project Settings",
  repositories: "Repositories",
  environments: "Environments",
}

export async function openProjectOverview(
  page: Page,
  subpath: "people" | "settings" | "repositories" | "environments",
) {
  const fixture = requireFixture()
  if (!fixture.tenantGroupId) {
    throw new Error(
      "Missing tenantGroupId in fixtures/os-project.json — run os-setup first.",
    )
  }

  const targetUrl = `${e2eBaseUrl()}/app/project/${fixture.tenantGroupId}/${subpath}`
  const dashboardUrl = canonicalDashboardUrl(fixture)

  // Project-overview pages read selectedTenantGroup from the store (not only the
  // URL). Seed that by opening the shared env dashboard first when localStorage
  // is cold, otherwise People/Settings can render empty after a bare deep-link.
  await gotoE2e(page, dashboardUrl)
  if (await isLoginSurface(page)) {
    await ensureAuthenticated(page)
    await reseedThenGoto(page, dashboardUrl, fixture.projectName, dashboardUrl)
  } else if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
    await reseedThenGoto(page, dashboardUrl, fixture.projectName, dashboardUrl)
  }

  await gotoE2e(page, targetUrl)

  if (await isLoginSurface(page)) {
    await ensureAuthenticated(page)
    await reseedThenGoto(page, targetUrl, fixture.projectName, dashboardUrl)
  } else if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
    await reseedThenGoto(page, targetUrl, fixture.projectName, dashboardUrl)
  }

  await expect(page).toHaveURL(new RegExp(`/app/project/${fixture.tenantGroupId}/${subpath}`), {
    timeout: 30_000,
  })
  await expect(
    page.getByRole("heading", { name: PROJECT_OVERVIEW_HEADING[subpath] }),
  ).toBeVisible({ timeout: 30_000 })

  await persistSuiteSession(page)
}

export async function openIam(page: Page, subpath: string, headingName: string | RegExp) {
  await gotoItemRoute(page, `iam/${subpath}`, { heading: headingName })
}

export async function openSecretManagement(
  page: Page,
  subpath: string,
  headingName: string | RegExp,
) {
  await gotoItemRoute(page, `secret-management/${subpath}`, { heading: headingName })
}

export async function openLmt(page: Page, subpath: "logs" | "tracing" | "usage") {
  await gotoItemRoute(page, `lmt/${subpath}`)
}

export async function openEmailManagement(page: Page) {
  await gotoItemRoute(page, "email-management", { heading: "Email Templates" })
}

import fs from "fs"
import path from "path"
import { expect, type Page } from "@playwright/test"
import { openNamedProjectDashboard } from "./create-and-delete-project"
import { e2eBaseUrl } from "./env"
import { ensureAuthenticated, isLoginSurface } from "./login-helper"
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
export function buildProjectRouteUrl(itemId: string, route: string) {
  const normalizedRoute = route.replace(/^\//, "")
  return `${e2eBaseUrl()}/app/${itemId}/${normalizedRoute}`
}

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
  await page.goto(targetUrl, { waitUntil: "domcontentloaded" })
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
  const dashboardUrl = fixture.dashboardUrl || buildProjectRouteUrl(fixture.itemId, "dashboard")

  for (let attempt = 0; attempt < 3; attempt++) {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded" })

    if (await isLoginSurface(page)) {
      await ensureAuthenticated(page)
      await reseedThenGoto(page, targetUrl, fixture.projectName, dashboardUrl)
    } else if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
      await reseedThenGoto(page, targetUrl, fixture.projectName, dashboardUrl)
    }

    const pathname = new URL(page.url()).pathname
    if (!/\/app\/console\/?$/i.test(pathname)) {
      break
    }
  }

  if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
    throw new Error(`Could not reach ${targetUrl} — still on console after reseed`)
  }

  if (ready) {
    await expect(page.getByRole("heading", { name: ready.heading })).toBeVisible({
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

async function waitForProjectsGets(page: Page) {
  await page
    .waitForResponse(
      (response) =>
        /\/Projects\/Gets/i.test(response.url()) &&
        response.request().method() === "GET" &&
        response.ok(),
      { timeout: 30_000 },
    )
    .catch(() => null)
}

/** ImpersonationTerminator runs on project-overview mount — give it a beat to finish. */
async function waitForImpersonationToClear(page: Page) {
  await page
    .waitForResponse(
      (response) => /impersonation/i.test(response.url()) && /stop/i.test(response.url()),
      { timeout: 20_000 },
    )
    .catch(() => null)
}

function parsePeopleGetsBody(body: unknown): { isOwner: boolean } {
  const payload = body as
    | { isOwner?: boolean; data?: { isOwner?: boolean } }
    | null
    | undefined
  return {
    isOwner: payload?.isOwner ?? payload?.data?.isOwner ?? false,
  }
}

async function clickPeopleNavAndWaitForGets(page: Page) {
  const peopleGetsPromise = page.waitForResponse(
    (response) =>
      /\/People\/Gets$/i.test(response.url()) && response.request().method() === "POST",
    { timeout: 30_000 },
  )

  await page.getByRole("link", { name: "People", exact: true }).click()
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
    timeout: 30_000,
  })

  const response = await peopleGetsPromise.catch(() => null)
  if (!response?.ok()) {
    return { isOwner: false }
  }

  const body = await response.json().catch(() => null)
  return parsePeopleGetsBody(body)
}

async function ensureEnvironmentsSeedReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText("X-Blocks-Key:").first()).toBeVisible({ timeout: 30_000 })
}

/** Seed project-overview store from URL (ProjectOverviewRoute) before sub-pages load. */
async function seedProjectOverviewStore(page: Page, tenantGroupId: string) {
  const seedUrl = `${e2eBaseUrl()}/app/project/${tenantGroupId}/environments`
  const projectsGetsPromise = waitForProjectsGets(page)
  await page.goto(seedUrl, { waitUntil: "domcontentloaded" })

  if (await isLoginSurface(page)) {
    const fixture = requireFixture()
    const dashboardUrl = fixture.dashboardUrl || buildProjectRouteUrl(fixture.itemId, "dashboard")
    await ensureAuthenticated(page)
    await reseedThenGoto(page, seedUrl, fixture.projectName, dashboardUrl)
  } else if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
    const fixture = requireFixture()
    const dashboardUrl = fixture.dashboardUrl || buildProjectRouteUrl(fixture.itemId, "dashboard")
    await reseedThenGoto(page, seedUrl, fixture.projectName, dashboardUrl)
  }

  await projectsGetsPromise
  await ensureEnvironmentsSeedReady(page)
  await waitForImpersonationToClear(page)
}

/**
 * People Invite only renders when useGetPeople runs with selectedTenantGroup set and
 * API returns isOwner. Never reload People — that remounts Zustand empty and keeps
 * the query disabled. Recover via Environments in-app nav, then console re-seed.
 */
export async function waitForPeoplePageReady(page: Page, tenantGroupId: string) {
  const inviteButton = page.getByRole("button", { name: "Invite" })

  if (await inviteButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
    return
  }

  for (let attempt = 0; attempt < 4; attempt++) {
    const onEnvironments = await page
      .getByRole("heading", { name: "Environments" })
      .isVisible({ timeout: 2_000 })
      .catch(() => false)

    if (!onEnvironments) {
      const environmentsNav = page.getByRole("link", { name: "Environments", exact: true })
      if (await environmentsNav.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await environmentsNav.click()
        await ensureEnvironmentsSeedReady(page)
      } else {
        await seedProjectOverviewStore(page, tenantGroupId)
      }
    }

    const peopleGets = await clickPeopleNavAndWaitForGets(page)

    if (
      peopleGets.isOwner &&
      (await inviteButton.isVisible({ timeout: 10_000 }).catch(() => false))
    ) {
      return
    }

    await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" })
    if (await isLoginSurface(page)) {
      await ensureAuthenticated(page)
    }
    await expect(
      page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
    ).toBeVisible({ timeout: 30_000 })
    await seedProjectOverviewStore(page, tenantGroupId)
  }

  await expect(inviteButton).toBeVisible({ timeout: 30_000 })
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

  // After env-dashboard specs, impersonation tokens can linger and make People/Gets
  // return isOwner=false with an empty list. Bounce through console first so
  // ImpersonationTerminator + a fresh project-overview mount reset tenant context.
  if (subpath === "people") {
    await page.goto(`${e2eBaseUrl()}/app/console`, { waitUntil: "domcontentloaded" })
    if (await isLoginSurface(page)) {
      await ensureAuthenticated(page)
    }
    await expect(
      page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
    ).toBeVisible({ timeout: 30_000 })
  }

  // ProjectOverviewRoute hydrates selectedTenantGroup from the URL — seed via
  // Environments first so People/Settings APIs query the correct group.
  await seedProjectOverviewStore(page, fixture.tenantGroupId)

  if (subpath === "environments") {
    await persistSuiteSession(page)
    return
  }

  if (subpath === "people") {
    await waitForPeoplePageReady(page, fixture.tenantGroupId)
    await persistSuiteSession(page)
    return
  }

  // In-app sidebar navigation preserves Zustand; page.goto would remount empty.
  const navLink = page.getByRole("link", {
    name: PROJECT_OVERVIEW_HEADING[subpath],
    exact: true,
  })
  await expect(navLink).toBeVisible({ timeout: 15_000 })
  await navLink.click()

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

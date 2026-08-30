import { Page, expect, test } from "@playwright/test"
import { e2eBaseUrl } from "./env"
import { ensureAuthenticated, isLoginSurface } from "./login-helper"
import { readOsProject } from "./os-project"

function getBaseProjectName(): string {
  return process.env.PROJECT_NAME?.trim() || "Test Project"
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function orphanProjectPatterns(): RegExp[] {
  const prefixes = new Set(["Test Project"])
  const configured = process.env.PROJECT_NAME?.trim()
  if (configured) prefixes.add(configured)
  return [...prefixes].map((prefix) => new RegExp(`${escapeRegExp(prefix)} \\d+`, "g"))
}

async function listOrphanProjectNames(page: Page): Promise<string[]> {
  const mainText = await page.locator("main").innerText().catch(() => "")
  const names = new Set<string>()
  for (const pattern of orphanProjectPatterns()) {
    for (const match of mainText.matchAll(pattern)) {
      names.add(match[0])
    }
  }
  return [...names]
}

const consoleProjectsHeading = (page: Page) =>
  page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ })

const isVisibleNow = async (locator: { isVisible: (opts: { timeout: number }) => Promise<boolean> }) =>
  locator.isVisible({ timeout: 500 }).catch(() => false)

const ENV_BUTTON =
  /Development|Testing|Staging|IAT|UAT|Production|Pre-Prod|Prod Shadow/

function addProjectControl(page: Page) {
  return page.getByText("Add Project", { exact: true }).first()
}

/** Wait until the console project grid has painted (Add Project and/or an env chip). */
async function waitForConsoleProjectsReady(page: Page) {
  // Do not use locator.or() + toBeVisible — when both sides match, Playwright
  // strict mode fails ("resolved to 2 elements").
  await Promise.race([
    addProjectControl(page).waitFor({ state: "visible", timeout: 20_000 }),
    page.getByRole("button", { name: ENV_BUTTON }).first().waitFor({ state: "visible", timeout: 20_000 }),
    consoleProjectsHeading(page).waitFor({ state: "visible", timeout: 20_000 }),
  ])
}

/** Make room on the console when prior runs left orphaned e2e projects behind. */
export async function freeProjectSlotIfNeeded(page: Page) {
  await ensureConsole(page)
  await waitForConsoleProjectsReady(page)

  const welcomeHeading = page.getByRole("heading", {
    name: "Welcome to SELISE Blocks",
  })
  if (await isVisibleNow(welcomeHeading)) {
    return
  }

  const addProjectButton = addProjectControl(page)
  if (await isVisibleNow(addProjectButton)) {
    return
  }

  const atProjectLimit = page.getByText("Please delete an existing project to create a new one.")
  const limitVisible = await isVisibleNow(atProjectLimit)

  if (!limitVisible && (await addProjectButton.isVisible({ timeout: 2_000 }).catch(() => false))) {
    return
  }

  for (let attempt = 0; attempt < 8; attempt++) {
    const orphanNames = await listOrphanProjectNames(page)
    if (orphanNames.length === 0) {
      break
    }

    await deleteProject(page, orphanNames[0]).catch(() => {})
    await ensureConsole(page)
    await waitForConsoleProjectsReady(page)

    if (await isVisibleNow(addProjectButton)) {
      return
    }
  }

  await expect(addProjectButton).toBeVisible({ timeout: 15_000 })
}

export async function createProject(page: Page) {
  await test.step("Start a new project", async () => {
    await ensureConsole(page)
    await waitForConsoleProjectsReady(page)

    const welcomeHeading = page.getByRole("heading", {
      name: "Welcome to SELISE Blocks",
    })
    const createProjectButton = page.getByRole("button", {
      name: "Create a project",
    })
    const addProjectButton = addProjectControl(page)

    await freeProjectSlotIfNeeded(page)

    if (await welcomeHeading.isVisible().catch(() => false)) {
      await createProjectButton.click()
    } else {
      await expect(addProjectButton).toBeVisible({ timeout: 15_000 })
      await addProjectButton.click()
    }
    await expect(page).toHaveURL(/\/app\/create-project$/, { timeout: 15_000 })
  })

  const projectName = `${getBaseProjectName()} ${Date.now()}`
  await test.step("Name the project and accept the agreements", async () => {
    await expect(page.getByRole("heading", { name: "Name your project" })).toBeVisible({
      timeout: 30_000,
    })
    const nameInput = page.locator('[placeholder="Enter your project name"]:visible')
    await nameInput.fill(projectName)

    await page.getByRole("checkbox", { name: "I confirm that I will use" }).click()
    await page.getByRole("checkbox", { name: "I accept the Terms of services" }).click()

    const continueButton = page.getByRole("button", { name: "Continue", exact: true })
    await expect(continueButton).toBeEnabled()
    await continueButton.click()
  })

  await test.step("Skip optional repositories", async () => {
    await expect(page.getByRole("heading", { name: "Add resource" })).toBeVisible({
      timeout: 30_000,
    })
    await page.getByRole("button", { name: "Continue", exact: true }).click()
  })

  await test.step("Select Development and submit", async () => {
    await expect(
      page.getByText("Select environments", { exact: true }).and(page.locator(":visible")),
    ).toBeVisible({ timeout: 30_000 })

    await page.getByText("Development", { exact: true }).and(page.locator(":visible")).click()
    const submitButton = page.getByRole("button", { name: "Submit" })
    await expect(submitButton).toBeEnabled()
    await submitButton.click()
  })

  await test.step("Wait for create success", async () => {
    await expect(page.getByText("Your project has been created.", { exact: true })).toBeVisible({
      timeout: 30_000,
    })
    // Dev often lands on /project/{id}/environments; prod may send you back to /app/console.
    await expect(page).toHaveURL(/\/app\/(console|project\/[^/]+\/environments)\/?$/, {
      timeout: 20_000,
    })
  })

  const tenantGroupId =
    new URL(page.url()).pathname.match(/\/app\/project\/([^/]+)\/environments/)?.[1] ?? ""

  await test.step("Open the new project's Development dashboard", async () => {
    if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
      await openNamedProjectDashboard(page, projectName)
      return
    }

    const developmentCard = page
      .locator('[class*="cursor-pointer"]')
      .filter({ has: page.getByText("Development", { exact: true }) })
      .filter({ hasText: "X-Blocks-Key:" })
      .first()

    await expect(developmentCard).toBeVisible({ timeout: 30000 })

    const setupPending = developmentCard.locator('[aria-label="Setup pending"]')
    if (await isVisibleNow(setupPending)) {
      const repairButton = developmentCard.locator('[aria-label="Repair environment"]')
      if (await isVisibleNow(repairButton)) {
        await repairButton.click()
        await page.getByRole("button", { name: "Repair" }).last().click()
      }
      await expect(setupPending).toHaveCount(0, { timeout: 60_000 })
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      await developmentCard.click({ force: true })
      try {
        await page.waitForURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 15_000 })
        break
      } catch (error) {
        if (attempt === 2) {
          throw error
        }
      }
    }

    await expect(page).toHaveURL(/\/app\/(?!project\/)[^/]+\/dashboard/, {
      timeout: 15000,
    })
    await expect(page.getByText("X-Blocks-Key:")).toBeVisible({
      timeout: 15000,
    })
  })

  const itemId = new URL(page.url()).pathname.split("/")[2] ?? ""
  const resolvedTenantGroupId =
    tenantGroupId || (await resolveTenantGroupId(page).catch(() => ""))
  if (!resolvedTenantGroupId || !itemId || itemId === "project") {
    throw new Error(
      `createProject could not resolve ids from ${page.url()} (tenantGroupId=${resolvedTenantGroupId}, itemId=${itemId})`,
    )
  }
  return {
    projectName,
    tenantGroupId: resolvedTenantGroupId,
    itemId,
    dashboardUrl: page.url(),
  }
}

/** OS project dashboard — X-Blocks-Key visible (fails fast if bounced to console). */
export async function waitForOsDashboardReady(page: Page, projectName?: string) {
  const ready = page.getByText("X-Blocks-Key:").first()

  const bouncedToConsole = async () => {
    if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) return true
    return consoleProjectsHeading(page).isVisible({ timeout: 500 }).catch(() => false)
  }

  const label = projectName ?? "shared project"
  const throwIfConsole = async () => {
    if (!(await bouncedToConsole())) return
    throw new Error(
      `Expected project dashboard for "${label}" but landed on the console. ` +
        "Suite setup must persist storageState after opening the shared project " +
        "(project/environment localStorage). Re-run os-setup.",
    )
  }

  await throwIfConsole()

  // Do not race waitForURL(...console).catch(() => null) against ready —
  // when we are already on the dashboard that waiter times out as `null`
  // and used to fail the 1s assertion even while the page was still painting.
  const appeared = await ready.waitFor({ state: "visible", timeout: 30_000 }).then(
    () => true,
    () => false,
  )
  if (!appeared) {
    await throwIfConsole()
    await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {})
    await throwIfConsole()
    await expect(ready).toBeVisible({ timeout: 30_000 })
  }

  await expect(page).toHaveURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 10_000 })
  if (projectName) {
    await expect(page.getByText(projectName, { exact: true }).first()).toBeVisible({
      timeout: 30_000,
    })
  }
}

async function readProjectNameFromDashboard(page: Page): Promise<string> {
  const sidebarProject = page.getByRole("button", { name: /^Project / })
  if (await sidebarProject.isVisible({ timeout: 3_000 }).catch(() => false)) {
    const label = await sidebarProject.innerText()
    return label.replace(/^Project\s+/i, "").trim()
  }

  const heading = page.locator("main").getByRole("heading").first()
  if (await heading.isVisible({ timeout: 3_000 }).catch(() => false)) {
    return (await heading.innerText()).trim()
  }

  throw new Error(`Could not read project name from dashboard: ${page.url()}`)
}

function extractTenantGroupIdFromUrl(url: string): string | null {
  return url.match(/\/app\/project\/([^/]+)/)?.[1] ?? null
}

async function extractTenantGroupIdFromLinks(page: Page): Promise<string | null> {
  const hrefs = await page.locator('a[href*="/app/project/"]').evaluateAll((anchors) =>
    anchors
      .map((anchor) => anchor.getAttribute("href") ?? "")
      .filter(Boolean),
  )

  for (const href of hrefs) {
    const tenantGroupId = extractTenantGroupIdFromUrl(href)
    if (tenantGroupId) return tenantGroupId
  }

  return null
}

async function extractTenantGroupIdFromFixture(page: Page): Promise<string | null> {
  const fixture = readOsProject()
  if (!fixture?.tenantGroupId) return null

  const itemId = new URL(page.url()).pathname.split("/")[2] ?? ""
  if (!itemId || itemId === "project") return null
  if (fixture.itemId === itemId) return fixture.tenantGroupId

  return null
}

async function extractTenantGroupIdFromStorage(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      try {
        const raw = localStorage.getItem(key)
        if (!raw) continue
        if (
          !raw.includes("selectedTenantGroup") &&
          !raw.includes("tenantGroupId") &&
          !raw.includes("TenantGroup")
        ) {
          continue
        }

        const parsed = JSON.parse(raw) as {
          state?: {
            selectedTenantGroup?: string
            selectedProject?: { tenantGroupId?: string }
          }
          selectedTenantGroup?: string
        }

        const candidates = [
          parsed.state?.selectedTenantGroup,
          parsed.state?.selectedProject?.tenantGroupId,
          parsed.selectedTenantGroup,
        ]

        for (const value of candidates) {
          if (typeof value === "string" && value.length > 0) return value
        }
      } catch {
        // try next key
      }
    }

    return null
  })
}

async function extractTenantGroupIdFromProjectApi(page: Page): Promise<string | null> {
  const responsePromise = page
    .waitForResponse(
      (response) =>
        /\/api\/Project\/Get\b/i.test(response.url()) &&
        response.request().method() === "GET" &&
        response.ok(),
      { timeout: 20_000 },
    )
    .catch(() => null)

  await page.reload({ waitUntil: "domcontentloaded" })
  await waitForOsDashboardReady(page).catch(() => {})

  const response = await responsePromise
  if (!response) return null

  const body = (await response.json().catch(() => null)) as {
    data?: { tenantGroupId?: string }
    tenantGroupId?: string
  } | null

  return body?.data?.tenantGroupId ?? body?.tenantGroupId ?? null
}

async function extractTenantGroupIdViaSidebar(page: Page): Promise<string | null> {
  const returnUrl = page.url()

  for (const linkName of ["Environments", "Project Settings", "People"] as const) {
    const link = page.getByRole("link", { name: linkName }).first()
    if (!(await link.isVisible({ timeout: 3_000 }).catch(() => false))) {
      continue
    }

    const href = await link.getAttribute("href")
    const fromHref = href ? extractTenantGroupIdFromUrl(href) : null
    if (fromHref) return fromHref

    await link.click()
    try {
      await page.waitForURL(/\/app\/project\/[^/]+\//, { timeout: 15_000 })
      const tenantGroupId = extractTenantGroupIdFromUrl(page.url())
      if (tenantGroupId) {
        if (page.url() !== returnUrl) {
          await page.goto(returnUrl, { waitUntil: "domcontentloaded" })
        }
        return tenantGroupId
      }
    } catch {
      // try next sidebar entry
    }
  }

  if (page.url() !== returnUrl) {
    await page.goto(returnUrl, { waitUntil: "domcontentloaded" })
  }

  return null
}

/** Read tenant group id — dashboard has no /app/project/ links until overview hydrate. */
export async function resolveTenantGroupId(page: Page): Promise<string> {
  const fromLinks = await extractTenantGroupIdFromLinks(page)
  if (fromLinks) return fromLinks

  const fromFixture = await extractTenantGroupIdFromFixture(page)
  if (fromFixture) return fromFixture

  const fromStorage = await extractTenantGroupIdFromStorage(page)
  if (fromStorage) return fromStorage

  const fromSidebar = await extractTenantGroupIdViaSidebar(page)
  if (fromSidebar) return fromSidebar

  const fromApi = await extractTenantGroupIdFromProjectApi(page)
  if (fromApi) return fromApi

  throw new Error(`Could not resolve tenantGroupId from ${page.url()}`)
}

async function openProjectById(page: Page, projectId: string) {
  await page.goto(`${e2eBaseUrl()}/app/${projectId}/dashboard`, { waitUntil: "domcontentloaded" })
  await waitForOsDashboardReady(page)

  const reuseName =
    process.env.E2E_REUSE_PROJECT_NAME?.trim() || process.env.E2E_PROJECT_NAME?.trim()
  const projectName = reuseName || (await readProjectNameFromDashboard(page))
  const tenantGroupId = await resolveTenantGroupId(page)

  return {
    projectName,
    dashboardUrl: page.url(),
    itemId: projectId,
    tenantGroupId,
  }
}

/** Reuse an existing OS project, or create one natively on Blocks OS. */
export async function reuseOrCreateSharedProject(page: Page): Promise<{
  projectName: string
  dashboardUrl: string
  itemId: string
  tenantGroupId: string
}> {
  await ensureAuthenticated(page)

  const configuredProjectId = process.env.E2E_PROJECT_ID?.trim()
  if (configuredProjectId) {
    return openProjectById(page, configuredProjectId)
  }

  await ensureConsole(page)
  await waitForConsoleProjectsReady(page)

  const reuseName =
    process.env.E2E_REUSE_PROJECT_NAME?.trim() || process.env.E2E_PROJECT_NAME?.trim()
  if (reuseName) {
    await openNamedProjectDashboard(page, reuseName)
    const itemId = new URL(page.url()).pathname.split("/")[2] ?? ""
    const tenantGroupId = await resolveTenantGroupId(page)
    return { projectName: reuseName, dashboardUrl: page.url(), itemId, tenantGroupId }
  }

  const testProjects = await listOrphanProjectNames(page)
  if (testProjects.length > 0) {
    const projectName = testProjects[testProjects.length - 1]!
    try {
      await openNamedProjectDashboard(page, projectName)
      const itemId = new URL(page.url()).pathname.split("/")[2] ?? ""
      const tenantGroupId = await resolveTenantGroupId(page)
      return { projectName, dashboardUrl: page.url(), itemId, tenantGroupId }
    } catch (error) {
      console.warn(
        `[e2e] Could not reopen orphan "${projectName}" — creating a new project instead.`,
        error,
      )
    }
  }

  try {
    const created = await createProject(page)
    return { ...created, dashboardUrl: page.url() }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    throw new Error(
      "Could not create a shared project on Blocks OS (Add Project missing or create failed). " +
        "Set E2E_REUSE_PROJECT_NAME (e.g. test) or E2E_PROJECT_ID, or free a console slot. " +
        `Cause: ${detail}`,
    )
  }
}

export function namedProjectCard(page: Page, projectName: string) {
  return page
    .locator("div")
    .filter({ has: page.getByText(projectName, { exact: true }) })
    .filter({
      has: page.getByRole("button", { name: ENV_BUTTON }),
    })
    .last()
}

export async function openProjectOverviewPage(
  page: Page,
  tenantGroupId: string,
  subpath: "people" | "settings" | "repositories" | "environments",
) {
  await page.goto(`${e2eBaseUrl()}/app/project/${tenantGroupId}/${subpath}`, {
    waitUntil: "domcontentloaded",
  })
  await expect(page).toHaveURL(new RegExp(`/app/project/${tenantGroupId}/${subpath}`), {
    timeout: 30000,
  })
}

export async function openDashboardChildPage(page: Page, itemId: string, subpath: string) {
  await page.goto(`${e2eBaseUrl()}/app/${itemId}/${subpath}`, { waitUntil: "domcontentloaded" })
  await expect(page).toHaveURL(new RegExp(`/app/${itemId}/${subpath}`), {
    timeout: 30000,
  })
}

export async function ensureConsole(page: Page) {
  const base = e2eBaseUrl()
  const pathname = new URL(page.url()).pathname
  if (/\/app\/console\/?$/.test(pathname)) {
    await expect(consoleProjectsHeading(page)).toBeVisible({ timeout: 30_000 })
    return
  }

  await page.goto(`${base}/app/console`, { waitUntil: "domcontentloaded" })
  if (await isLoginSurface(page)) {
    await ensureAuthenticated(page)
    return
  }
  await expect(consoleProjectsHeading(page)).toBeVisible({ timeout: 30_000 })
}

export async function openNamedProjectDashboard(
  page: Page,
  projectName: string,
  options?: { dashboardUrl?: string },
) {
  if (options?.dashboardUrl) {
    await page.goto(options.dashboardUrl, { waitUntil: "domcontentloaded" })
    try {
      await waitForOsDashboardReady(page, projectName)
      return
    } catch {
      // Fall through to console card navigation.
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await ensureConsole(page)
    await waitForConsoleProjectsReady(page)
    const card = namedProjectCard(page, projectName)
    await expect(card).toBeVisible({ timeout: 30_000 })
    const development = card.getByRole("button", { name: ENV_BUTTON }).first()
    await expect(development).toBeVisible({ timeout: 15_000 })
    await development.click({ force: true })

    try {
      await waitForOsDashboardReady(page, projectName)
      return
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
}

export async function openProjectConfigure(page: Page, projectName: string) {
  await ensureConsole(page)
  const card = namedProjectCard(page, projectName)
  await expect(card).toBeVisible({ timeout: 30000 })
  await card.getByRole("button", { name: ENV_BUTTON }).first().click({ force: true })
  await page.waitForURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 30000 })
}

export async function deleteCreatedProject(
  page: Page,
  projectName?: string,
  options?: { itemId?: string },
): Promise<boolean> {
  if (!projectName) return false
  void options

  try {
    await deleteProject(page, projectName)
    await ensureConsole(page)
    await expect(page.getByText(projectName, { exact: true })).toHaveCount(0, {
      timeout: 10_000,
    })
    return true
  } catch (error) {
    console.warn(`[e2e] Failed to delete project "${projectName}":`, error)
    return false
  }
}

export async function deleteProject(page: Page, projectName: string) {
  if (!projectName) {
    throw new Error("deleteProject requires the created project name")
  }

  await test.step("Return to console before deleting the project", async () => {
    await ensureConsole(page)
  })

  await test.step("Open the created project from 'Your Blocks Projects'", async () => {
    await openNamedProjectDashboard(page, projectName)
  })

  await test.step("'Delete' is visible on the Overview page for the project owner", async () => {
    await expect(
      page.getByRole("button", {
        name: "Delete",
        exact: true,
      }),
    ).toBeVisible({
      timeout: 30000,
    })
  })

  await test.step("Clicking 'Delete' opens the exact confirmation dialog", async () => {
    await page
      .getByRole("button", {
        name: "Delete",
        exact: true,
      })
      .click()

    await expect(
      page.getByRole("heading", {
        name: "Delete this environment?",
      }),
    ).toBeVisible()

    await expect(page.getByText("Are you sure you want to delete this environment?")).toBeVisible()

    await expect(
      page.getByText(
        "This will permanently delete the environment and you'll need to contact support to recover it.",
      ),
    ).toBeVisible()

    await expect(
      page.getByRole("button", {
        name: "Cancel",
      }),
    ).toBeVisible()

    await expect(
      page
        .getByRole("button", {
          name: "Delete",
          exact: true,
        })
        .last(),
    ).toBeVisible()
  })

  await test.step("Confirming delete shows the success toast and redirects to the console", async () => {
    const confirmDeleteButton = page
      .getByRole("button", {
        name: "Delete",
        exact: true,
      })
      .last()

    await confirmDeleteButton.click()

    await expect(
      page.getByText("Successfully deleted", {
        exact: true,
      }),
    ).toBeVisible({
      timeout: 20000,
    })

    await expect(page).toHaveURL(/\/app\/console$/, {
      timeout: 20000,
    })
  })

  await test.step("The deleted project no longer appears in the project list", async () => {
    await expect(page.getByText(projectName, { exact: true })).toHaveCount(0)
  })

  return { projectName }
}

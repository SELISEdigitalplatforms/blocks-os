import { chromium } from "@playwright/test"
import {
  deleteCreatedProject,
  listE2eProjectNamesOnConsole,
  openNamedProjectDashboard,
} from "./support/create-and-delete-project"
import { loginFresh } from "./support/login-helper"
import { clearOsProject, clearOsSession, readOsProject } from "./support/os-project"
import { releaseRunLock } from "./support/run-lock"
import { shouldDeleteSharedProject } from "./support/run-outcome"

/**
 * After every suite run (pass or fail), delete each environment by opening
 * `/app/{itemId}/dashboard` directly (no console chip clicks). Env ids come
 * from fixtures/os-project.json (recorded at create / add-env) or Project/Gets.
 *
 * Starts from an empty browser context and a real OIDC login. Reusing the
 * suite's storageState here is what used to fail teardown: the access token
 * is often already expired (see session-lifecycle.ts), but the console HTML
 * still paints, so loginFresh skipped OIDC and every delete API then 401'd.
 *
 * Opt out only with E2E_KEEP_PROJECT=1.
 */
export default async function globalTeardown() {
  try {
    await runTeardown()
  } finally {
    releaseRunLock()
  }
}

async function runTeardown() {
  const fixture = readOsProject()
  if (!fixture && process.env.E2E_KEEP_PROJECT === "1") {
    console.log("[e2e] Teardown: no fixture and E2E_KEEP_PROJECT=1 — skipping.")
    return
  }

  if (!shouldDeleteSharedProject()) {
    console.log(
      `[e2e] Keeping project "${fixture?.projectName ?? "(unknown)"}" on the console (E2E_KEEP_PROJECT=1).`,
    )
    return
  }

  const browser = await chromium.launch()
  try {
    const context = await browser.newContext({ ignoreHTTPSErrors: true })
    const page = await context.newPage()

    await loginFresh(page)

    // Seed project/environment localStorage from the console card so later
    // `/app/{itemId}/dashboard` navigations actually land on Overview.
    if (fixture?.projectName) {
      try {
        await openNamedProjectDashboard(page, fixture.projectName)
      } catch (error) {
        console.warn(
          "[e2e] Teardown: could not reseed project dashboard — continuing from console:",
          error instanceof Error ? error.message : error,
        )
      }
    }

    const namesToDelete = new Set<string>()
    if (fixture?.projectName) namesToDelete.add(fixture.projectName)

    const onConsole = await listE2eProjectNamesOnConsole(page)
    for (const name of onConsole) namesToDelete.add(name)

    if (namesToDelete.size === 0) {
      console.log("[e2e] Teardown: no e2e projects on the console — nothing to delete.")
      clearOsProject()
      clearOsSession()
      return
    }

    let allDeleted = true
    for (const projectName of namesToDelete) {
      const isFixtureProject = fixture?.projectName === projectName
      console.log(
        `[e2e] Teardown: deleting every environment on "${projectName}" via dashboard URLs ` +
          "(pass/fail does not matter)…",
      )
      const deleted = await deleteCreatedProject(
        page,
        projectName,
        isFixtureProject && fixture
          ? {
              itemId: fixture.itemId,
              tenantGroupId: fixture.tenantGroupId,
              environmentIds: fixture.environmentIds ?? [fixture.itemId],
            }
          : undefined,
      )
      if (!deleted) {
        allDeleted = false
        console.log(
          `[e2e] Project "${projectName}" was not fully deleted — ` +
            "remove remaining environments manually from the console if needed.",
        )
      } else {
        console.log(`[e2e] Teardown complete: deleted all environments for "${projectName}".`)
      }
    }

    if (allDeleted) {
      clearOsProject()
      clearOsSession()
    }
  } finally {
    await browser.close()
  }
}

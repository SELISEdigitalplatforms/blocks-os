import fs from "fs"
import { chromium } from "@playwright/test"
import {
  deleteCreatedProject,
  listE2eProjectNamesOnConsole,
} from "./support/create-and-delete-project"
import { ensureAuthenticated } from "./support/login-helper"
import { clearOsProject, clearOsSession, OS_SESSION_PATH, readOsProject } from "./support/os-project"
import { shouldDeleteSharedProject } from "./support/run-outcome"
import { refreshSuiteSession } from "./support/session-lifecycle"

/**
 * After every suite run (pass or fail), delete each environment by opening
 * `/app/{itemId}/dashboard` directly (no console chip clicks). Env ids come
 * from fixtures/os-project.json (recorded at create / add-env) or Project/Gets.
 *
 * Opt out only with E2E_KEEP_PROJECT=1.
 */
export default async function globalTeardown() {
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
    const context = await browser.newContext({
      ignoreHTTPSErrors: true,
      ...(fs.existsSync(OS_SESSION_PATH) ? { storageState: OS_SESSION_PATH } : {}),
    })
    const page = await context.newPage()

    try {
      if (fixture?.projectName) {
        await refreshSuiteSession(page)
      } else {
        await ensureAuthenticated(page)
      }
    } catch (error) {
      console.warn(
        "[e2e] Teardown: refreshSuiteSession failed — falling back to ensureAuthenticated:",
        error instanceof Error ? error.message : error,
      )
      await ensureAuthenticated(page)
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

import { test, expect } from "@playwright/test"
import fs from "fs"
import path from "path"
import { reuseOrCreateSharedProject } from "../../support/create-and-delete-project"
import { loginThroughOidc } from "../../support/login-helper"
import { OS_SESSION_PATH, writeOsProject } from "../../support/os-project"
import { resetRunOutcome } from "../../support/run-outcome"
import { resetSessionRefreshClock } from "../../support/session-lifecycle"

test.describe("os suite setup", () => {
  test("login, reuse or create one shared project on Blocks OS", async ({ page }) => {
    test.setTimeout(300_000)
    resetRunOutcome()

    await loginThroughOidc(page)
    await expect(
      page.getByRole("heading", { name: /Your Blocks Projects|Welcome to SELISE Blocks/ }),
    ).toBeVisible({ timeout: 30_000 })

    const { projectName, dashboardUrl, itemId, tenantGroupId } =
      await reuseOrCreateSharedProject(page)
    if (!itemId || !tenantGroupId) {
      throw new Error(
        `Could not resolve ids from dashboard URL: ${dashboardUrl} ` +
          `(itemId=${itemId}, tenantGroupId=${tenantGroupId})`,
      )
    }

    writeOsProject({
      projectName,
      itemId,
      tenantGroupId,
      dashboardUrl: dashboardUrl.replace(/\?.*$/, ""),
    })

    // Persist AFTER the shared project is open so localStorage keeps the selected
    // project/environment. Saving only post-login makes /app/{id}/dashboard bounce
    // back to /app/console in feature tests.
    fs.mkdirSync(path.dirname(OS_SESSION_PATH), { recursive: true })
    await page.context().storageState({ path: OS_SESSION_PATH })
    resetSessionRefreshClock()
  })
})

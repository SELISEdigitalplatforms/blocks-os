import { expect, type Page } from "@playwright/test"
import { openEmailManagement } from "./os-helpers"

const DEFAULT_SEED_TIMEOUT_MS = 300_000
const POLL_INTERVAL_MS = 15_000

/** How long suite setup waits for a project's default data (`E2E_SEED_TIMEOUT_MS`). */
export function seedDataTimeoutMs(): number {
  const raw = Number(process.env.E2E_SEED_TIMEOUT_MS)
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_SEED_TIMEOUT_MS
}

/**
 * Wait until the project's default data has been copied in.
 *
 * Creating a project only queues provisioning. Some time later the worker
 * (ConfigureProjectConsumer → ProjectRepository.CreateDefaultConfigurationAsync)
 * copies the default Roles, Permissions, EmailTemplates, BlocksLanguages,
 * StorageConfigurations, FileDirectories and more from BlocksConfiguration.
 * The server records no "done" flag — Project/GetProjectStatus is already
 * true before the copy has run — so poll for the data itself. The built-in
 * email templates are copied in the same Task.WhenAll as everything else, so
 * once they are listed the rest is in place too.
 *
 * Returns false (and warns) when the data never shows up, so the suite still
 * runs and the tests that need it fail with their own clear messages.
 */
export async function waitForProjectSeedData(page: Page): Promise<boolean> {
  const timeoutMs = seedDataTimeoutMs()
  const started = Date.now()

  for (;;) {
    // A full navigation each round, so the list is fetched fresh rather than
    // served from the SPA's query cache.
    await openEmailManagement(page)
    const tabpanel = page.getByRole("tabpanel", { name: "Templates", exact: true })
    const templateRow = tabpanel
      .getByRole("row")
      .filter({ has: page.getByRole("button", { name: "Open menu", exact: true }) })
      .first()
    const emptyState = tabpanel.getByText("No templates found.", { exact: true })
    await expect(templateRow.or(emptyState)).toBeVisible({ timeout: 30_000 })

    const elapsedS = Math.round((Date.now() - started) / 1000)
    if (await templateRow.isVisible()) {
      console.log(`[e2e] Project default data is in place (waited ${elapsedS}s).`)
      return true
    }
    if (Date.now() - started + POLL_INTERVAL_MS > timeoutMs) {
      console.warn(
        `[e2e] Project default data (email templates, languages, roles, permissions, ` +
          `storage directories) still missing after ${elapsedS}s. The background ` +
          `provisioning copy has not finished or has failed — check this project's ` +
          `ProjectStatusTracers entry (ErrorMessage) and the Worker logs. Tests that ` +
          `need that data will fail.`,
      )
      return false
    }
    await page.waitForTimeout(POLL_INTERVAL_MS)
  }
}

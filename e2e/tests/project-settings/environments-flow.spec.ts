import { test, expect } from "../../support/test-base"
import { openProjectOverview } from "../../support/os-helpers"

// Environments flow: open the Environments list -> add a new environment
// (when owner and under the 8-environment cap) -> open Development dashboard ->
// return to the list -> optionally open the migration wizard.
test.describe("flows", () => {
  test("Environments flow: list -> add environment -> open its dashboard -> back to list", async ({
    page,
  }) => {
    test.setTimeout(180_000)

    await test.step("Open Environments", async () => {
      await openProjectOverview(page, "environments")
      await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
        timeout: 30000,
      })
    })

    await test.step("Environments page shows at least the Development card", async () => {
      await expect(page.getByText("X-Blocks-Key:").first()).toBeVisible({ timeout: 10000 })
      await expect(page.getByText("Development", { exact: true }).first()).toBeVisible({
        timeout: 10000,
      })
    })

    let addedNewEnvironment = false
    await test.step("Add a new environment via 'New Environment'", async () => {
      const newEnvButton = page.getByRole("button", { name: "New Environment" })
      if (!(await newEnvButton.isVisible({ timeout: 5000 }).catch(() => false))) {
        return
      }
      await newEnvButton.click()
      await expect(page.getByRole("heading", { name: "Add Environment" })).toBeVisible({
        timeout: 10000,
      })

      const firstCheckbox = page.getByRole("checkbox").first()
      if (!(await firstCheckbox.isVisible({ timeout: 5000 }).catch(() => false))) {
        await page.keyboard.press("Escape")
        return
      }

      const addButton = page.getByRole("button", { name: "Add" })
      await expect(addButton).toBeDisabled()

      await firstCheckbox.click()
      await expect(addButton).toBeEnabled()
      await addButton.click()

      await expect(page.getByRole("heading", { name: "Add Environment" })).toBeHidden({
        timeout: 15000,
      })
      addedNewEnvironment = true
    })

    await test.step("Open the Development environment dashboard", async () => {
      const developmentCard = page
        .locator('[class*="cursor-pointer"]')
        .filter({ has: page.getByText("Development", { exact: true }) })
        .filter({ hasText: "X-Blocks-Key:" })
        .first()

      await expect(developmentCard).toBeVisible({ timeout: 15000 })

      const setupPending = developmentCard.locator('[aria-label="Setup pending"]')
      if (await setupPending.isVisible({ timeout: 3000 }).catch(() => false)) {
        return
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        await developmentCard.click({ force: true })
        try {
          await page.waitForURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 20_000 })
          await expect(page.getByText("X-Blocks-Key:")).toBeVisible({ timeout: 15_000 })
          await expect(page.getByText("Domains", { exact: true })).toBeVisible({ timeout: 15_000 })
          return
        } catch (error) {
          if (attempt === 2) throw error
        }
      }
    })

    await test.step("Return to the Environments list", async () => {
      await openProjectOverview(page, "environments")
      await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
        timeout: 30000,
      })
      if (addedNewEnvironment) {
        const cards = page
          .locator('[class*="cursor-pointer"]')
          .filter({ hasText: "X-Blocks-Key:" })
        await expect(cards.first()).toBeVisible({ timeout: 15000 })
      }
    })

    await test.step("'Start Migration' opens the Environment Migration wizard", async () => {
      const startMigrationButton = page.getByRole("button", { name: "Start Migration" })
      if (await startMigrationButton.isVisible({ timeout: 8000 }).catch(() => false)) {
        await startMigrationButton.click()
        await expect(page.getByText("Environment migration", { exact: true }).last()).toBeVisible({
          timeout: 15000,
        })
        await expect(
          page.getByText("Environments & services", { exact: true }).last(),
        ).toBeVisible()

        await page.getByRole("link", { name: "Close migration" }).click()
        await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
          timeout: 15000,
        })
      }
    })
  })
})

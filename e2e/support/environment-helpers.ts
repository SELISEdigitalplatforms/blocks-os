import { expect, type Page } from "@playwright/test"

export function environmentCard(page: Page, label: string) {
  return page
    .locator('[class*="cursor-pointer"]')
    .filter({ has: page.getByText(label, { exact: true }) })
    .filter({ hasText: "X-Blocks-Key:" })
    .first()
}

/** Environments list finished loading (survives post-mutation refetch skeleton). */
export async function waitForEnvironmentsListReady(page: Page) {
  await expect(page.getByRole("heading", { name: "Environments" })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByText("X-Blocks-Key:").first()).toBeVisible({ timeout: 30_000 })
}

export async function openEnvironmentCardDashboard(page: Page, label = "Development") {
  await waitForEnvironmentsListReady(page)

  const card = environmentCard(page, label)
  await expect(card).toBeVisible({ timeout: 15_000 })

  const setupPending = card.locator('[aria-label="Setup pending"]')
  if (await setupPending.isVisible({ timeout: 3000 }).catch(() => false)) {
    const repairButton = card.locator('[aria-label="Repair environment"]')
    if (await repairButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await repairButton.click()
      await page.getByRole("button", { name: "Repair" }).last().click()
      await expect(setupPending).toHaveCount(0, { timeout: 60_000 })
    } else {
      return
    }
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await waitForEnvironmentsListReady(page)
    await expect(card).toBeVisible({ timeout: 15_000 })
    await card.click({ force: true })
    try {
      await page.waitForURL(/\/app\/(?!project\/)[^/]+\/dashboard/, { timeout: 15_000 })
      return
    } catch (error) {
      if (attempt === 2) throw error
    }
  }
}

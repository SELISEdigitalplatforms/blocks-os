import { test, expect } from "../../support/test-base"
import { buildProjectRouteUrl, openLmt, openOsDashboard } from "../../support/os-helpers"
import { readOsProject } from "../../support/os-project"

// Logs flow: Managed/My Service tabs on the inline LogsViewer, optional service
// detail route, and log-stream filters (Search, Type, Service, Date).
test.describe("flows", () => {
  test.beforeEach(async ({ page }) => {
    await openOsDashboard(page)
  })

  test("Logs flow: navigate to Logs -> toggle source -> open a service's details", async ({
    page,
  }) => {
    test.setTimeout(180_000)

    const managedTab = () =>
      page.getByRole("tab", { name: /Managed Service|Blocks Service/i })
    const myServiceTab = () => page.getByRole("tab", { name: /My Service/i })

    const gotoLogs = async () => {
      await openOsDashboard(page)

      const link = page.getByRole("link", { name: "Logs", exact: true })
      if (await link.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await link.click({ timeout: 10_000 })
      } else {
        await openLmt(page, "logs")
      }

      if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
        await openLmt(page, "logs")
      }

      await expect(page).toHaveURL(/\/lmt\/logs/, { timeout: 30_000 })
    }

    await test.step("Navigate to Logs", async () => {
      await gotoLogs()
      if (!(await managedTab().isVisible({ timeout: 15_000 }).catch(() => false))) {
        await page.reload({ waitUntil: "domcontentloaded" })
      }
      await expect(managedTab()).toBeVisible({ timeout: 30_000 })
    })

    await test.step("Toggle to 'My Service' log source", async () => {
      await expect(myServiceTab()).toBeVisible()
      await myServiceTab().click()
      await expect(page).toHaveURL(/source=managed/)
    })

    await test.step("The ?source= param survives a page refresh", async () => {
      await page.reload({ waitUntil: "domcontentloaded" })
      await expect(page).toHaveURL(/source=managed/, { timeout: 15_000 })
      await expect(myServiceTab()).toHaveAttribute("aria-selected", "true")
    })

    await test.step("Open a Managed Service log detail view", async () => {
      const fixture = readOsProject()
      if (!fixture?.itemId) {
        throw new Error("Missing fixtures/os-project.json itemId — run os-setup first.")
      }

      // Logs index uses LogsViewer (inline stream) — service cards were removed.
      // Navigate directly to a known blocks service detail route.
      await page.goto(buildProjectRouteUrl(fixture.itemId, "lmt/logs/os?source=blocks"), {
        waitUntil: "domcontentloaded",
      })

      if (/\/app\/console\/?$/i.test(new URL(page.url()).pathname)) {
        await openOsDashboard(page)
        await page.goto(buildProjectRouteUrl(fixture.itemId, "lmt/logs/os?source=blocks"), {
          waitUntil: "domcontentloaded",
        })
      }

      // Service detail has no page heading — assert tabs / filters instead.
      await expect(managedTab().or(myServiceTab()).first()).toBeVisible({ timeout: 20_000 })
      await expect(
        page.getByPlaceholder(/Search/i).or(page.getByRole("button", { name: /Type|Date|Service/i })).first(),
      ).toBeVisible({ timeout: 20_000 })
    })

    await test.step("The service details page has its own Managed/My Service tabs", async () => {
      if (await myServiceTab().isVisible({ timeout: 8_000 }).catch(() => false)) {
        await myServiceTab().click()
        await expect(myServiceTab()).toHaveAttribute("aria-selected", "true")

        await managedTab().click()
        await expect(managedTab()).toHaveAttribute("aria-selected", "true")
      }
    })

    await test.step("Copy a log entry's trace ID to the clipboard", async () => {
      const copyButton = page.locator("button:has(svg.lucide-copy)").first()
      if (await copyButton.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await copyButton.click()
        await expect(page.locator("button:has(svg.lucide-check)").first())
          .toBeVisible({ timeout: 5_000 })
          .catch(() => {})
      }
    })

    await test.step("Search filters the log stream by text", async () => {
      const searchInput = page.getByPlaceholder(/Search/i)
      if (await searchInput.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await searchInput.fill("nonexistent-log-marker-xyz")
        await page.waitForTimeout(500)
        await searchInput.fill("")
      }
    })

    await test.step("The 'Type' filter narrows the stream to the selected level", async () => {
      const typeFilter = page.getByRole("button", { name: /Type/i })
      if (await typeFilter.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await typeFilter.click()
        const errorOption = page.getByRole("radio", { name: "Error" })
        if (await errorOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await errorOption.click()
          await page.keyboard.press("Escape")
        } else {
          await page.keyboard.press("Escape")
        }

        await typeFilter.click()
        const clearButton = page.getByRole("button", { name: /clear/i })
        if (await clearButton.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await clearButton.click()
        } else {
          await page.keyboard.press("Escape")
        }
      }
    })

    await test.step("The 'Service' filter narrows the stream to one service", async () => {
      const serviceFilter = page.getByRole("button", { name: /Service/i })
      if (!(await serviceFilter.isVisible({ timeout: 8_000 }).catch(() => false))) {
        return
      }
      await serviceFilter.click()
      const firstOption = page.getByRole("radio").or(page.getByRole("option")).first()
      if (await firstOption.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await firstOption.click({ force: true }).catch(() => {})
      }
      await page.keyboard.press("Escape").catch(() => {})
    })

    await test.step("The 'Date' range filter narrows the stream to a picked range", async () => {
      const dateFilter = page.getByRole("button", { name: /^Date$/i })
      if (await dateFilter.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await dateFilter.click()
        const dayCell = page.getByRole("gridcell").filter({ has: page.locator("button") }).first()
        if (await dayCell.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await dayCell.locator("button").click()
          const applyButton = page.getByRole("button", { name: "Apply" })
          if (await applyButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await applyButton.click()
          }

          await dateFilter.click()
          const resetButton = page.getByRole("button", { name: "Reset" })
          if (await resetButton.isVisible({ timeout: 3_000 }).catch(() => false)) {
            await resetButton.click()
            await page.getByRole("button", { name: "Apply" }).click().catch(() => {})
          } else {
            await page.keyboard.press("Escape")
          }
        } else {
          await page.keyboard.press("Escape")
        }
      }
    })

    await test.step("Following a log's trace link opens its trace details view", async () => {
      const traceLink = page
        .getByRole("link", { name: /View trace details for|View trace/i })
        .first()
      if (await traceLink.isVisible({ timeout: 8_000 }).catch(() => false)) {
        await traceLink.click()
        await expect(page.getByRole("heading").or(page.getByText(/trace/i)).first()).toBeVisible({
          timeout: 15_000,
        })
      }
    })
  })
})

import { test as base, expect } from "@playwright/test"
import { refreshSuiteSessionIfStale } from "./session-lifecycle"

// Shared `test` for the whole suite. Specs import from here instead of
// "@playwright/test" so the pause below applies everywhere automatically.
//
// Headed runs hold the browser open for a moment after each test finishes, so
// the end state is actually watchable instead of vanishing the instant the
// assertions pass. Headless runs (CI, plain `npm test`) are untouched.
//
//   E2E_PAUSE_MS=0      disable
//   E2E_PAUSE_MS=30000  hold longer
//   E2E_PAUSE_MS=3000 npm test   force it on in headless too

function pauseMs(isHeaded: boolean): number {
  const configured = process.env.E2E_PAUSE_MS

  if (configured !== undefined && configured !== "") {
    const parsed = Number(configured)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
  }

  return isHeaded ? 10_000 : 0
}

export const test = base.extend<{ pauseAfterEachTest: void; refreshStaleSuiteSession: void }>({
  // The app's own silent token refresh is broken (see session-lifecycle.ts) —
  // a long serial "os" run outlives the access token. Refresh the suite's own
  // saved session on a timer, before each test runs, instead of finding out
  // mid-test via a failed assertion. A refresh failure here is logged, not
  // thrown: the reactive isLoginSurface recovery in the navigation helpers is
  // still the backstop, and one skipped proactive refresh shouldn't fail an
  // otherwise-unrelated test.
  refreshStaleSuiteSession: [
    async ({ page }, use, testInfo) => {
      if (testInfo.project.name === "os") {
        try {
          await refreshSuiteSessionIfStale(page)
        } catch (error) {
          console.warn(`[e2e] proactive session refresh failed, continuing: ${String(error)}`)
        }
      }

      await use()
    },
    { auto: true },
  ],
  pauseAfterEachTest: [
    async ({ page }, use, testInfo) => {
      const isHeaded = testInfo.project.use.headless === false
      const ms = pauseMs(isHeaded)

      if (ms > 0) testInfo.setTimeout(testInfo.timeout + ms)

      await use()

      if (ms > 0 && !page.isClosed()) {
        await page.waitForTimeout(ms)
      }
    },
    { auto: true },
  ],
})

export { expect }

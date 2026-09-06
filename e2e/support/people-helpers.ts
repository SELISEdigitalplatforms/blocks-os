import { expect, type Locator, type Page } from "@playwright/test"
import { ensureAuthenticated, isLoginSurface } from "./login-helper"
import { refreshSuiteSession } from "./session-lifecycle"

/**
 * People list + Invite only render after the people API reports isOwner.
 * Cold store / late fetch can hide Invite until reload or a reseeded navigation.
 */
export async function waitForPeopleOwnerReady(
  page: Page,
  reopen?: () => Promise<void>,
) {
  await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByRole("table")).toBeVisible({ timeout: 30_000 })

  const invite = page.getByRole("button", { name: "Invite" })
  const maxAttempts = 4

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (await invite.isVisible({ timeout: 5_000 }).catch(() => false)) {
      return
    }

    // The suite session can expire mid-run (long serial suite). A plain
    // reload then lands on the logged-out marketing page instead of People —
    // re-authenticate and reopen before re-asserting, same recovery path
    // openProjectOverview already uses for other flows.
    if (await isLoginSurface(page)) {
      await ensureAuthenticated(page)
    } else if (attempt >= 1) {
      // Reload alone didn't surface Invite, and the page never actually
      // looked logged out — right URL, "People" heading, table all render
      // fine. A stale/degraded access token can still pass those cheap
      // checks while failing the isOwner-gated People fetch specifically
      // (the app's own silent refresh is broken — see session-lifecycle.ts).
      // ensureAuthenticated() only re-logs-in once isLoginSurface() is true,
      // so it would no-op here forever — force a real OIDC login instead of
      // repeating the same plain reload.
      await refreshSuiteSession(page)
    }

    if (reopen) {
      await reopen()
    } else {
      await page.reload({ waitUntil: "domcontentloaded" })
    }

    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 30_000,
    })
    await expect(page.getByRole("table")).toBeVisible({ timeout: 30_000 })
  }

  await expect(invite).toBeVisible({ timeout: 30_000 })
}

/**
 * Inviting a brand-new / inactive email often does not insert its ProjectPeople
 * row synchronously: the backend may return invitation_requested or
 * user_creation_requested and only insert after IAM posts back. The People
 * flow's pass criterion is "invite was sent", not "row is listed" — so this
 * helper only polls briefly and returns whether the row appeared.
 */
export async function tryWaitForInvitedPersonRow(
  page: Page,
  personRow: Locator,
  reopen?: () => Promise<void>,
): Promise<boolean> {
  const maxAttempts = 3

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (await personRow.isVisible({ timeout: 8_000 }).catch(() => false)) {
      return true
    }
    if (attempt === maxAttempts - 1) break

    await page.waitForTimeout(3_000)
    if (reopen) {
      await reopen()
    } else {
      await page.reload({ waitUntil: "domcontentloaded" })
    }
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 30_000,
    })
  }

  return personRow.isVisible({ timeout: 5_000 }).catch(() => false)
}

/** @deprecated Prefer tryWaitForInvitedPersonRow — invite-send is the pass criterion. */
export async function waitForInvitedPersonRow(
  page: Page,
  personRow: Locator,
  reopen?: () => Promise<void>,
) {
  const found = await tryWaitForInvitedPersonRow(page, personRow, reopen)
  if (!found) {
    throw new Error(
      "Invited person's row never appeared after a short poll. " +
        "If People/Invite already returned isSuccess, treat invite-send as the pass criterion " +
        "instead of requiring the async ProjectPeople row.",
    )
  }
}

import { expect, type Page } from "@playwright/test"

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

  for (let attempt = 0; attempt < 3; attempt++) {
    if (await invite.isVisible({ timeout: 5_000 }).catch(() => false)) {
      return
    }

    if (attempt === 0) {
      await page.reload({ waitUntil: "domcontentloaded" })
    } else if (reopen) {
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

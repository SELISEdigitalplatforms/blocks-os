import fs from "fs"
import path from "path"
import { test } from "@playwright/test"
import { SNAPSHOT_ROUTES } from "../../support/snapshot-routes"

const SNAPSHOTS_DIR = path.resolve(__dirname, "../../snapshots")

type SnapshotManifestEntry = {
  id: string
  name: string
  file: string
  url: string
  title: string
  capturedAt: string
}

test.describe("capture page snapshots", () => {
  test("download accessibility snapshots for all feature routes", async ({ page }) => {
    test.setTimeout(900_000)

    fs.mkdirSync(SNAPSHOTS_DIR, { recursive: true })

    const manifest: SnapshotManifestEntry[] = []

    for (const route of SNAPSHOT_ROUTES) {
      await test.step(`capture ${route.id}`, async () => {
        await route.navigate(page)
        await page.waitForLoadState("domcontentloaded")
        if (route.waitForReady) {
          await route.waitForReady(page)
        }

        const snapshot = await page.locator("body").ariaSnapshot()
        const title = await page.title()
        const url = page.url()
        const file = `${route.id}.yml`
        const body = [
          "### Page",
          `- Page URL: ${url}`,
          `- Page Title: ${title}`,
          "### Snapshot",
          snapshot,
          "",
        ].join("\n")

        fs.writeFileSync(path.join(SNAPSHOTS_DIR, file), body, "utf8")

        manifest.push({
          id: route.id,
          name: route.name,
          file,
          url,
          title,
          capturedAt: new Date().toISOString(),
        })
      })
    }

    fs.writeFileSync(
      path.join(SNAPSHOTS_DIR, "index.json"),
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          count: manifest.length,
          routes: manifest,
        },
        null,
        2,
      ),
      "utf8",
    )
  })
})

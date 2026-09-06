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
    const onlyIds = (process.env.SNAPSHOT_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
    const routes = onlyIds.length
      ? SNAPSHOT_ROUTES.filter((route) => onlyIds.includes(route.id))
      : SNAPSHOT_ROUTES

    if (onlyIds.length && routes.length === 0) {
      throw new Error(`SNAPSHOT_IDS matched no routes: ${onlyIds.join(", ")}`)
    }

    for (const route of routes) {
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

    const indexPath = path.join(SNAPSHOTS_DIR, "index.json")
    const previous =
      onlyIds.length && fs.existsSync(indexPath)
        ? (JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
            routes?: SnapshotManifestEntry[]
          })
        : { routes: [] as SnapshotManifestEntry[] }

    // Partial captures merge into the existing index so other routes stay listed.
    // Full captures replace it entirely from this run's manifest.
    const byId = new Map(
      (onlyIds.length ? previous.routes ?? [] : []).map((entry) => [entry.id, entry]),
    )
    for (const entry of manifest) {
      byId.set(entry.id, entry)
    }
    // Also keep any on-disk .yml that isn't in SNAPSHOT_ROUTES yet (stale but useful).
    if (onlyIds.length) {
      for (const file of fs.readdirSync(SNAPSHOTS_DIR).filter((name) => name.endsWith(".yml"))) {
        const id = file.replace(/\.yml$/, "")
        if (byId.has(id)) continue
        const prior = (previous.routes ?? []).find((entry) => entry.id === id)
        if (prior) byId.set(id, prior)
      }
    }

    const merged = [...byId.values()]

    fs.writeFileSync(
      indexPath,
      JSON.stringify(
        {
          capturedAt: new Date().toISOString(),
          count: merged.length,
          routes: merged,
        },
        null,
        2,
      ),
      "utf8",
    )
  })
})

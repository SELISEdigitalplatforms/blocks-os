import fs from "fs"
import path from "path"

export type OsProjectFixture = {
  projectName: string
  /** Primary / default environment item id (usually Development). */
  itemId: string
  tenantGroupId: string
  dashboardUrl: string
  /**
   * Every environment itemId under this project group. Teardown deletes by
   * navigating `/app/{id}/dashboard` directly — no console chip clicks.
   * Kept in sync when envs are created or discovered via Project/Gets.
   */
  environmentIds?: string[]
}

const FIXTURE_PATH = path.resolve(__dirname, "../fixtures/os-project.json")
export const OS_SESSION_PATH = path.resolve(__dirname, "../fixtures/os-session.json")

export function readOsProject(): OsProjectFixture | null {
  if (!fs.existsSync(FIXTURE_PATH)) return null
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8")) as OsProjectFixture
}

export function writeOsProject(fixture: OsProjectFixture) {
  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true })
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2))
}

export function clearOsProject() {
  if (fs.existsSync(FIXTURE_PATH)) fs.unlinkSync(FIXTURE_PATH)
}

export function clearOsSession() {
  if (fs.existsSync(OS_SESSION_PATH)) fs.unlinkSync(OS_SESSION_PATH)
}

export function osSessionExists(): boolean {
  return fs.existsSync(OS_SESSION_PATH)
}

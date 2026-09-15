import fs from "node:fs"
import path from "node:path"

function stripTrailingSlash(url: string): string {
  return url.replace(/\/$/, "")
}

/** Append-only debug trail. Never writes to stdout — teardown/storage stay quiet in the reporter. */
export function e2eDebugLog(message: string, extra?: unknown) {
  const suffix =
    extra === undefined
      ? ""
      : ` ${extra instanceof Error ? extra.message : String(extra)}`
  try {
    const logPath = path.resolve(process.cwd(), "test-results/e2e-debug.log")
    fs.mkdirSync(path.dirname(logPath), { recursive: true })
    fs.appendFileSync(logPath, `${new Date().toISOString()} ${message}${suffix}\n`)
  } catch {
    // Ignore disk errors — a missing debug log must not fail the suite.
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} is not set. Fill it in e2e/.env.e2e.`)
  }
  return value
}

/** Blocks OS app under test (`E2E_BASE_URL`). */
export function e2eBaseUrl(): string {
  return stripTrailingSlash(requireEnv("E2E_BASE_URL"))
}

export function e2eProjectId(): string | undefined {
  const value = process.env.E2E_PROJECT_ID?.trim()
  return value || undefined
}

export function e2eCredentials(): { email: string; password: string } {
  return {
    email: requireEnv("E2E_USERNAME"),
    password: requireEnv("E2E_PASSWORD"),
  }
}

/** Domain for synthetic addresses created during tests (invites, new users). */
export function e2eTestEmailDomain(): string {
  // Accept "yopmail.com" or accidental "@yopmail.com" / "user@yopmail.com" values.
  const raw = (process.env.E2E_TEST_EMAIL_DOMAIN ?? "example.com").trim()
  const at = raw.lastIndexOf("@")
  return (at >= 0 ? raw.slice(at + 1) : raw).replace(/^\.+/, "") || "example.com"
}

export function uniqueTestEmail(localPart = "e2e"): string {
  return `${localPart}.${Date.now()}@${e2eTestEmailDomain()}`
}

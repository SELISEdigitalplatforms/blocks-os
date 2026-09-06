import fs from "fs"
import path from "path"

const LOCK_PATH = path.resolve(__dirname, "../fixtures/.run.lock")

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

/**
 * Refuse to start a second concurrent e2e invocation against the same
 * shared project. Without this, a second run's globalTeardown deletes the
 * shared project (and clears fixtures/os-project.json / os-session.json)
 * the instant IT finishes — even while a sibling run is still mid-suite
 * depending on that same project. Not hypothetical: it happened, mid-run,
 * turning a batch of "Missing fixtures/os-project.json" failures into
 * something that looked like real regressions.
 */
export function acquireRunLock(): void {
  if (fs.existsSync(LOCK_PATH)) {
    const pid = Number(fs.readFileSync(LOCK_PATH, "utf8").trim())
    if (Number.isFinite(pid) && isProcessAlive(pid)) {
      throw new Error(
        `Another e2e run (pid ${pid}) appears to be in progress against the same shared project. ` +
          "Its globalTeardown will delete that project the instant it finishes, which would corrupt " +
          "this run. Wait for it to finish, or delete fixtures/.run.lock yourself if it's stale " +
          "(left behind by a run that crashed before reaching its own teardown).",
      )
    }
    // Stale lock — the owning process is gone (crashed/killed run). Proceed.
  }
  fs.mkdirSync(path.dirname(LOCK_PATH), { recursive: true })
  fs.writeFileSync(LOCK_PATH, String(process.pid))
}

export function releaseRunLock(): void {
  if (fs.existsSync(LOCK_PATH)) fs.unlinkSync(LOCK_PATH)
}

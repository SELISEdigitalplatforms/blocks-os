#!/usr/bin/env node
/**
 * Run `playwright test` (forwarding any CLI args, e.g. a file/grep filter),
 * then print the pass/fail + reason summary regardless of whether the run
 * passed or failed — a plain `playwright test` only shows this in scattered
 * per-test blocks (or not at all for expected-fail/flaky), and stops short
 * if you don't scroll back through the whole run.
 *
 * Usage: npm run test:report -- [any playwright test args]
 */
import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const forwardedArgs = process.argv.slice(2)

// "snapshot-capture" isn't a correctness test (see playwright.config.ts) and
// is only meant to run on demand via `npm run snapshots:capture` — a bare
// `playwright test` still runs every declared project unless told
// otherwise, so default to the real test projects here too, unless the
// caller already picked project(s) of their own.
const DEFAULT_PROJECTS = ["setup", "os-setup", "os"]
const hasOwnProjectFilter = forwardedArgs.some((arg) => arg === "--project" || arg.startsWith("--project="))
const projectArgs = hasOwnProjectFilter
  ? []
  : DEFAULT_PROJECTS.flatMap((name) => ["--project", name])

const playwrightRun = spawnSync("npx", ["playwright", "test", ...projectArgs, ...forwardedArgs], {
  cwd: e2eDir,
  stdio: "inherit",
  shell: process.platform === "win32",
})

console.log("")
console.log("=".repeat(60))
console.log("Summary")
console.log("=".repeat(60))

const reportRun = spawnSync("node", ["scripts/test-report.mjs"], {
  cwd: e2eDir,
  stdio: "inherit",
})

// Exit non-zero if the actual test run failed, even if the report itself
// printed cleanly — this script's exit code is what CI/scripts should key
// off, same as a bare `playwright test` would.
process.exit(playwrightRun.status ?? reportRun.status ?? 1)

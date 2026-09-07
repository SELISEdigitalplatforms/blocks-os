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
import { orderedSuiteSpecs } from "../features.mjs"

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const forwardedArgs = process.argv.slice(2)

const looksLikeSpecArg = (arg) =>
  arg.endsWith(".spec.ts") || arg.startsWith("tests/") || arg.startsWith("e2e/tests/")

const hasOwnProjectFilter = forwardedArgs.some((arg) => arg === "--project" || arg.startsWith("--project="))
const hasSpecFilter = forwardedArgs.some(looksLikeSpecArg)

const DEFAULT_PROJECTS = ["setup", "os-setup", "os"]
const projectArgs = hasOwnProjectFilter
  ? []
  : DEFAULT_PROJECTS.map((name) => `--project=${name}`)
const specArgs = hasSpecFilter ? [] : orderedSuiteSpecs()

const playwrightRun = spawnSync("npx", ["playwright", "test", ...forwardedArgs, ...projectArgs, ...specArgs], {
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

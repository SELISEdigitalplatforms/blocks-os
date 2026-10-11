#!/usr/bin/env node
/**
 * Run enabled OS features in sidebar order (suite setup/teardown via playwright projects).
 * Edit features.mjs or set E2E_FEATURES=overview,users
 *
 * Extra CLI args are forwarded to Playwright (e.g. --headed, --ui, --debug).
 */
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { orderedSuiteSpecs, resolveEnabledFeatures } from "./features.mjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function main() {
  const features = resolveEnabledFeatures()

  if (features.length === 0) {
    console.error("[e2e] No features enabled. Edit features.mjs or set E2E_FEATURES.")
    process.exit(1)
  }

  console.log(`[e2e] Running ${features.length} feature(s) in sidebar order:`)
  for (const feature of features) {
    console.log(`  - ${feature.id}: ${feature.name}`)
  }

  const forwardedArgs = process.argv.slice(2)
  const looksLikeSpecArg = (arg) =>
    arg.endsWith(".spec.ts") || arg.startsWith("tests/")
  const hasSpecFilter = forwardedArgs.some(looksLikeSpecArg)
  const specArgs = hasSpecFilter ? [] : orderedSuiteSpecs()

  // Run Playwright's own CLI script with the current node binary instead of
  // going through `npx`. On Windows `npx` is `npx.cmd`, which spawnSync can
  // only find through a shell; a plain .js file under node_modules runs the
  // same way on Windows, Linux and macOS, with no shell and no argument
  // re-quoting, and always uses the locally installed Playwright version.
  const playwrightCli = require.resolve("@playwright/test/cli")

  const result = spawnSync(
    process.execPath,
    [
      playwrightCli,
      "test",
      ...forwardedArgs,
      "--project=setup",
      "--project=os-setup",
      "--project=os",
      ...specArgs,
    ],
    {
      cwd: __dirname,
      stdio: "inherit",
      env: process.env,
    },
  )

  if (result.error) {
    console.error(`[e2e] Could not start Playwright: ${result.error.message}`)
  }
  process.exit(result.status ?? 1)
}

main()

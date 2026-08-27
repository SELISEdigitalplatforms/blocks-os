#!/usr/bin/env node
/**
 * Run the OS e2e suite (auth smoke + os-setup → features → os-teardown).
 * Feature list: features.cjs
 *   npm test              → E2E_FEATURES=all (every suite in features.cjs)
 *   npm run test:features → enabled flags / E2E_FEATURES=overview,users
 */
import { spawnSync } from "node:child_process"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const require = createRequire(import.meta.url)
const { resolveEnabledFeatures } = require("./features.cjs")

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function main() {
  const features = resolveEnabledFeatures()

  if (features.length === 0) {
    console.error("[e2e] No features enabled. Edit features.cjs or set E2E_FEATURES.")
    process.exit(1)
  }

  console.log(`[e2e] Running ${features.length} feature(s) in order:`)
  for (const feature of features) {
    console.log(`  - ${feature.id}: ${feature.name}`)
  }

  // Do not pass individual spec paths — that skips os-teardown (dependents are
  // not selected). Filtering lives in playwright.config.ts via features.cjs.
  // Run all Playwright projects so auth smoke ([setup]) is included with the OS suite.
  const result = spawnSync("npx", ["playwright", "test", "--max-failures=1"], {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  })

  process.exit(result.status ?? 1)
}

main()

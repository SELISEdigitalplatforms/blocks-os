#!/usr/bin/env node
/**
 * Read the Playwright JSON reporter output and print a compact pass/fail
 * summary with a concise reason for every failure — the same thing we've
 * been doing by hand all conversation (reading each test's error-context.md
 * one at a time). Requires the "json" reporter to be configured in
 * playwright.config.ts (outputFile: test-results/results.json).
 *
 * Usage: node scripts/test-report.mjs [path-to-results.json]
 */
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const e2eDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const resultsPath = path.resolve(e2eDir, process.argv[2] ?? "test-results/results.json")

if (!fs.existsSync(resultsPath)) {
  console.error(
    `[test-report] No results file at ${path.relative(e2eDir, resultsPath)}. ` +
      `Run tests first (the "json" reporter must be configured in playwright.config.ts).`,
  )
  process.exit(1)
}

const report = JSON.parse(fs.readFileSync(resultsPath, "utf8"))

function collectSpecs(suite, titlePath = [], inheritedFile) {
  const nextPath = suite.title ? [...titlePath, suite.title] : titlePath
  // Only the outermost (per-file) suite reliably carries `file` — nested
  // describe-block suites and their specs don't always repeat it, so thread
  // it down from whichever ancestor suite last had one.
  const file = suite.file ?? inheritedFile
  const specs = (suite.specs ?? []).map((spec) => ({
    file: spec.file ?? file,
    fullTitle: [...nextPath, spec.title].join(" › "),
    tests: spec.tests ?? [],
  }))
  for (const child of suite.suites ?? []) {
    specs.push(...collectSpecs(child, nextPath, file))
  }
  return specs
}

const specs = (report.suites ?? []).flatMap((s) => collectSpecs(s))

function stripAnsi(text) {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\[[0-9;]*m/g, "")
}

/** A short, readable reason from a Playwright error message — a few
 * non-empty lines (the important context for expect() failures usually
 * spans "Locator:"/"Expected:"/"Received:" lines, not just line 1), capped
 * so the summary stays scannable. */
function summarizeReason(message) {
  if (!message) return "(no error message captured)"
  const lines = stripAnsi(message)
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
  const joined = lines.slice(0, 6).join(" | ")
  return joined.length > 400 ? `${joined.slice(0, 400)}…` : joined
}

function formatDuration(ms) {
  if (!ms || ms < 0) return "0.0s"
  return `${(ms / 1000).toFixed(1)}s`
}

let passed = 0
let failed = 0
let flaky = 0
let skipped = 0
const failures = []

for (const spec of specs) {
  for (const test of spec.tests) {
    const results = test.results ?? []
    const lastResult = results[results.length - 1]
    const duration = results.reduce((sum, r) => sum + (r.duration ?? 0), 0)
    // fullTitle already starts with the file path — Playwright's JSON
    // reporter titles the outermost per-file suite with the file path
    // itself, so prefixing spec.file again here would just repeat it.
    const label = `${spec.fullTitle} [${test.projectName}]`

    switch (test.status) {
      case "expected": {
        if (test.expectedStatus === "failed" || test.expectedStatus === "timedOut") {
          // test.fail() — a known, intentionally-failing regression. Still
          // surface the reason: "expected to fail" isn't the same as "safe
          // to ignore why".
          const reason = summarizeReason(
            lastResult?.errors?.[0]?.message ?? lastResult?.error?.message,
          )
          console.log(`\x1b[33m~\x1b[0m ${label} (${formatDuration(duration)}) — known issue`)
          console.log(`    ${reason}`)
          passed++
        } else {
          console.log(`\x1b[32m✓\x1b[0m ${label} (${formatDuration(duration)})`)
          passed++
        }
        break
      }
      case "flaky": {
        flaky++
        console.log(`\x1b[33m⚠\x1b[0m ${label} (${formatDuration(duration)}) — passed after retry`)
        break
      }
      case "skipped": {
        skipped++
        console.log(`\x1b[90m⊘\x1b[0m ${label} — skipped`)
        break
      }
      default: {
        // "unexpected" — a genuine, unanticipated failure.
        failed++
        const reason = summarizeReason(
          lastResult?.errors?.[0]?.message ?? lastResult?.error?.message,
        )
        failures.push({ label, reason })
        console.log(`\x1b[31m✗\x1b[0m ${label} (${formatDuration(duration)})`)
        console.log(`    ${reason}`)
      }
    }
  }
}

console.log("")
console.log(
  `${passed} passed, ${failed} failed, ${flaky} flaky, ${skipped} skipped ` +
    `(${passed + failed + flaky + skipped} total)`,
)

if (failures.length > 0) {
  console.log("")
  console.log("Failures needing a look:")
  for (const { label, reason } of failures) {
    console.log(`  - ${label}`)
    console.log(`    ${reason}`)
  }
}

process.exit(failed > 0 ? 1 : 0)

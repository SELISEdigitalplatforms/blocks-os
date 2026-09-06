import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"
import fs from "fs"
import path from "path"

dotenv.config({ path: path.resolve(__dirname, ".env.e2e") })

const baseURL = process.env.E2E_BASE_URL

if (!baseURL) {
  throw new Error(
    "E2E_BASE_URL is not set. Copy e2e/.env.e2e.example to e2e/.env.e2e and set E2E_BASE_URL to your named domain.",
  )
}

const autoStartServer = process.env.E2E_NO_WEBSERVER !== "1"
const osSessionPath = path.resolve(__dirname, "fixtures/os-session.json")

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  timeout: 180_000,
  // "json" feeds scripts/test-report.mjs (npm run test:report) — a compact
  // pass/fail summary with the failure reason for every test, instead of
  // scrolling back through the list reporter's scattered per-test blocks.
  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["json", { outputFile: "test-results/results.json" }],
  ],
  globalSetup: "./global-setup.ts",
  // Deletes the shared project every run, pass or fail — a globalTeardown
  // always runs once per invocation regardless of which project/file/grep
  // filter was passed on the command line. The old "os-teardown" project
  // (see git history) only ran when it was actually selected, which a
  // filtered `playwright test tests/some-file.spec.ts` never does — that
  // was silently skipping cleanup on anything but a bare full-suite run.
  globalTeardown: "./global-teardown.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
    launchOptions: {
      slowMo: process.env.E2E_SLOWMO ? Number(process.env.E2E_SLOWMO) : 0,
    },
  },
  ...(autoStartServer
    ? {
        webServer: {
          command: "bash run.sh -b",
          cwd: path.resolve(__dirname, ".."),
          url: baseURL,
          reuseExistingServer: true,
          ignoreHTTPSErrors: true,
          timeout: 600_000,
          stdout: "pipe" as const,
          stderr: "pipe" as const,
          env: {
            FrontendRuntime__BLOCKS_OS_BASE_URL: baseURL,
          },
        },
      }
    : {}),
  projects: [
    {
      name: "setup",
      testMatch: /auth[\\/]login\.spec\.ts/,
      timeout: 120_000,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "os-setup",
      testMatch: /suite\.setup\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "os",
      testMatch: /.*\.spec\.ts/,
      // capture-snapshots.spec.ts is not a correctness test — it regenerates
      // reference .yml snapshots on demand via `npm run snapshots:capture`.
      testIgnore: [/auth[\\/]login\.spec\.ts/, /suite\.setup\.spec\.ts/, /capture-snapshots\.spec\.ts/],
      dependencies: ["os-setup"],
      use: {
        ...devices["Desktop Chrome"],
        ...(fs.existsSync(osSessionPath) ? { storageState: "fixtures/os-session.json" } : {}),
      },
    },
    // Opt-in only. A bare `playwright test` / `npm test` must not run this
    // 25-route walk (it was suite test #28 and added ~1.5m plus a stale
    // token for globalTeardown). `npm run snapshots:capture` sets the env.
    ...(process.env.E2E_CAPTURE_SNAPSHOTS === "1"
      ? [
          {
            name: "snapshot-capture",
            testMatch: /capture-snapshots\.spec\.ts/,
            dependencies: ["os-setup"],
            timeout: 900_000,
            use: {
              ...devices["Desktop Chrome"],
              ...(fs.existsSync(osSessionPath) ? { storageState: "fixtures/os-session.json" } : {}),
            },
          },
        ]
      : []),
  ],
})

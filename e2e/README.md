# Blocks OS — End-to-End Tests (Playwright)

Follows the shared Blocks product e2e suite template,
same shape as `blocks-utilities/e2e` and `blocks-localization/e2e`.

**OS difference:** create, reuse, and delete all happen **natively on Blocks OS**
in suite setup/teardown — no cross-app hop to another product.

## One-time setup

1. **Configure env**: copy the template and fill in your values:

   ```bash
   cd e2e
   cp .env.e2e.example .env.e2e
   ```

   Set `E2E_BASE_URL` (your named domain, e.g. `https://dev-os.blocksdevelopers.com:5000`),
   `E2E_USERNAME`, `E2E_PASSWORD`. `.env.e2e` is gitignored; never commit real
   credentials.

2. **Install** Playwright + the browser:

   ```bash
   cd e2e
   npm install
   npx playwright install chromium
   ```

## Run

From the repo root:

```bash
./run.sh -te          # or: .\run.ps1 -te
```

or directly:

```bash
cd e2e
npm test              # os-setup + feature specs + os-teardown
```

### Against remote dev (default)

```
E2E_BASE_URL=https://dev-os.blocksdevelopers.com
E2E_NO_WEBSERVER=1
```

Reuse an existing project (recommended when console slots are limited):

```
E2E_REUSE_PROJECT_NAME=test
# or
E2E_PROJECT_ID=<uuid>
E2E_KEEP_PROJECT=1
```

When reusing a non-ephemeral project, set `E2E_KEEP_PROJECT=1` so teardown does
not delete it after a green run.

### Against a local build

```
E2E_BASE_URL=https://dev-os.blocksdevelopers.com:5000
# E2E_NO_WEBSERVER left unset / not 1
```

Hosts entry:

```
127.0.0.1 dev-os.blocksdevelopers.com
```

### Other run modes

```bash
npm run test:headed   # watch it in a real browser
npm run test:ui       # Playwright UI mode
npm run report        # open the last HTML report (from e2e/)
```

## Knobs in `.env.e2e`

| Variable | Effect |
|---|---|
| `E2E_BASE_URL` | Blocks **OS** host. Dev: `https://dev-os.blocksdevelopers.com`. Prod: `https://os.seliseblocks.com`. |
| `E2E_USERNAME` / `E2E_PASSWORD` | OIDC test account. |
| `PROJECT_NAME` | Optional create prefix (`${PROJECT_NAME} ${Date.now()}`). |
| `E2E_REUSE_PROJECT_NAME` | Reuse named project instead of creating. |
| `E2E_PROJECT_NAME` | Legacy alias for `E2E_REUSE_PROJECT_NAME`. |
| `E2E_PROJECT_ID` | Open project by UUID — skips console card search. |
| `E2E_KEEP_PROJECT=1` | Never delete shared project after run. |
| `E2E_NO_WEBSERVER=1` | Don't auto-start the app (required for remote host). |
| `E2E_PAUSE_MS` | Hold browser after each test (headed debugging). |
| `E2E_SLOWMO` | Slow motion ms per Playwright action. |

## Lifecycle

Playwright projects: **`os-setup` → `os` → `os-teardown`**

### Previously vs now (important)

**Before:** every feature spec had its own `beforeEach` → `createProject()` and
`afterEach` → `deleteCreatedProject()`. A full run created and deleted **one
project per test** (~25 projects per run).

**Now:** **one shared project** for the whole suite — created (or reused) once in
`os-setup`, used by all feature tests via direct URLs + `os-helpers`, deleted once
in `os-teardown` when every test passes.

Feature specs must **not** call `createProject` / `deleteCreatedProject`. Only
`suite.setup.spec.ts` and `suite.teardown.spec.ts` manage project lifecycle.

1. **Suite setup** (`tests/suite/suite.setup.spec.ts`) — OIDC login on OS, reuse or create one shared project **on OS**, write `os-project.json`, then save `os-session.json` **after** the dashboard is open (so localStorage keeps project/env).
2. **Features** (`tests/overview`, `tests/identity-and-access`, …) — use session; open routes with direct `goto` to `/app/{itemId}/...` via `os-helpers`.
3. **Session / context recovery** — login gate or console bounce → re-auth if needed, one env-chip open to reseed localStorage, persist session (never create a new project).
4. **Suite teardown** (`tests/suite/suite.teardown.spec.ts`) — delete on **Blocks OS** only when every `os` test passed (unless `E2E_KEEP_PROJECT=1`).

## Layout

```
e2e/
  tests/
    auth/login.spec.ts            # standalone auth smoke (project "setup")
    suite/
      suite.setup.spec.ts         # login + shared project (native OS create)
      suite.teardown.spec.ts      # OS delete when suite passed
    overview/
    identity-and-access/
    secrets-and-configs/
    project-settings/
    logs-and-traces/
    email-management/
  support/
    os-project.ts                 # fixtures/os-session.json + os-project.json
    suite-helpers.ts              # openSharedProjectDashboard
    os-helpers.ts                 # openIam, openSecretManagement, openLmt, …
    create-and-delete-project.ts  # native OS create/delete + reuse
    run-outcome.ts                # markSuiteTestFailed / shouldDeleteSharedProject
    test-base.ts
  fixtures/                       # gitignored session + project JSON
  playwright.config.ts
  SPEC-multi-env.md
```

## Discovering / updating selectors

```bash
npm run codegen -- <E2E_BASE_URL>/login
```

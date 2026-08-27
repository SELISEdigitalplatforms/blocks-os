# Blocks OS — End-to-End Tests (Playwright)

Follows the shared Blocks product e2e template
([`e2e-spec/SPEC-blocks-e2e-suite-template.md`](/home/noor/Office-Projects/e2e-spec/SPEC-blocks-e2e-suite-template.md)),
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

```bash
cd e2e
npm test              # create new project → full suite from features.cjs → teardown
npm run test:features # respects features.cjs `enabled` flags / E2E_FEATURES subset
npm run test:auth     # standalone login smoke only
```

With `E2E_REUSE_PROJECT_NAME` set in `.env.e2e`, setup opens that project instead of creating.

Subset (via `test:features` or by overriding env):

```bash
E2E_FEATURES=overview,users npm run test:features
```

### Against remote (prod/dev)

```
E2E_BASE_URL=https://os.seliseblocks.com
E2E_NO_WEBSERVER=1
```

By default `npm test` **creates** a new project (`PROJECT_NAME` + timestamp, or `Test Project` + timestamp).

Reuse an existing project instead:

```
E2E_REUSE_PROJECT_NAME=test
# or
E2E_PROJECT_ID=<uuid>
E2E_KEEP_PROJECT=1
```

### Other run modes

```bash
npm run test:headed
npm run test:ui
npm run report        # from e2e/
```

## Knobs in `.env.e2e`

| Variable | Effect |
|---|---|
| `E2E_BASE_URL` | Blocks **OS** host |
| `E2E_USERNAME` / `E2E_PASSWORD` | OIDC test account |
| `PROJECT_NAME` | Optional create prefix (`${PROJECT_NAME} ${Date.now()}`) |
| `E2E_REUSE_PROJECT_NAME` | Reuse named project instead of creating |
| `E2E_PROJECT_NAME` | Legacy alias for `E2E_REUSE_PROJECT_NAME` |
| `E2E_PROJECT_ID` | Open project by UUID — skips console card search |
| `E2E_KEEP_PROJECT=1` | Never delete shared project after run |
| `E2E_NO_WEBSERVER=1` | Don't auto-start the app |
| `E2E_FEATURES` | `all` (default via `npm test`), feature ids, or omit for `enabled` flags (`test:features`) |
| `E2E_PAUSE_MS` | Hold browser after each test (headed debugging) |
| `E2E_SLOWMO` | Slow motion ms per Playwright action |

## Lifecycle

Playwright projects: **`os-setup` → `os` → `os-teardown`**

### Previously vs now

**Before:** every feature spec had `beforeEach` → `createProject()` and
`afterEach` → `deleteCreatedProject()` (one project per test).

**Now:** **one shared project** for the whole suite — created (or reused) once in
`os-setup`, used by all feature tests via direct URLs + `os-helpers`, deleted once
in `os-teardown` when every test passes.

1. **Suite setup** — OIDC login on OS, reuse or create one shared project **on OS**, write `os-project.json`, save `os-session.json` **after** the dashboard is open.
2. **Features** — use session; open routes with direct `goto` via `os-helpers`.
3. **Recovery** — login gate or console bounce → re-auth if needed, one env-chip open to reseed localStorage, persist session (never create a new project).
4. **Suite teardown** — delete on OS only when every `os` test passed (unless `E2E_KEEP_PROJECT=1`).

## Layout

```
e2e/
  features.cjs / run-e2e.mjs  # feature registry + npm test entry
  tests/
    auth/login.spec.ts
    suite/
      suite.setup.spec.ts
      suite.teardown.spec.ts
    overview/
    identity-and-access/
    secrets-and-configs/
    project-settings/
    logs-and-traces/
    email-management/
  support/
    os-project.ts
    suite-helpers.ts
    os-helpers.ts
    create-and-delete-project.ts
    run-outcome.ts
    features.ts               # OsFeature type only (list lives in features.cjs)
    test-base.ts
  fixtures/                 # gitignored session + project JSON
  playwright.config.ts
  SPEC-multi-env.md
```

# Blocks OS; End-to-End Tests (Playwright)

E2E tests that drive the real app through the browser, including the dev-iam
login redirect flow.

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

## Run (single command)

```bash
cd e2e
npm test
```

That's it. `npm test` will:

1. start the app via `run.sh -a` from the repo root (builds the FE, syncs to
   `server/Api/wwwroot`, runs API + Worker),
2. wait until `E2E_BASE_URL` responds (up to 10 min for the first build),
3. run the tests, then
4. shut the server down.

If the app is **already** running at `E2E_BASE_URL`, it is reused (no rebuild).

> Auto-start uses `bash run.sh -a`, so **Git Bash's `bash` must be on PATH**
> (`run.ps1 -a` can't be automated). To manage the server yourself instead, run
> it manually and start tests with auto-start disabled:
>
> ```bash
> E2E_NO_WEBSERVER=1 npm test
> ```

### Other run modes

```bash
npm run test:headed   # watch it in a real browser
npm run test:ui       # Playwright UI mode
npm run report        # open the last HTML report
```

## Manual selector inspection

The normal E2E update workflow is the graph workflow below. Use Playwright
codegen only for manual inspection when selectors are unclear or a live page
needs verification.

The username/password fields live on the dev-iam page. To inspect selectors
against the live page:

```bash
npm run codegen -- <E2E_BASE_URL>/login
```

## E2E graph workflow for humans and AI

The graph is the E2E source of truth. For any AI coding task that changes
`client/app/**`, run:

```bash
npm run graph:impact
```

If the verdict is `likely`, `definite`, or `unknown`, update flow E2E coverage and the graph in the same change. Do not wait for a separate human reminder.

### Graph source files

```text
e2e/graph/flow-graph.json          source of truth
e2e/graph/uncovered-baseline.json  uncovered-node classification
e2e/graph/flow-graph.md            generated Mermaid, gitignored
e2e/graph/selector-index.json      generated selector cache, gitignored
```

Generated files from `npm run graph:render` are local only and do not need to be committed.

### Impact evaluation order

`graph:impact` is the authority for impact classification:

```text
1. git diff unavailable -> unknown
2. no client/app/** files changed -> none
3. router.tsx or navigation-menus.ts changed -> definite
4. touched client/app files contain an action keyword in a user-action surface -> likely
5. selector-index.json is missing or stale -> unknown
6. diff removes/alters selector-index text -> definite
7. otherwise -> possible
```

Cache-independent signals are evaluated before selector cache checks. Missing or stale
`selector-index.json` returns `unknown` only when no stronger signal was found.

Useful graph commands:

```bash
npm run graph:inventory   # list discovered app surface
npm run graph:render      # regenerate local graph docs and selector cache
npm run graph:update -- --patch e2e/graph/patch.json
```

Required validation after E2E or graph changes:

```bash
npm run graph:check
npm run lint
npx tsc --project tsconfig.json --noEmit
```

### Coverage rules

Graph node IDs are derived from canonical routes, not menu IDs:

```text
/app/project/:tenantGroupId/settings -> app-project-tenantGroupId-settings
/app/:itemId/idp/settings            -> app-itemId-idp-settings
```

Baseline statuses:

```text
backlog
needs-e2e
needs-flow
no-e2e-needed
covered-by-parent
```

- Flow tests are the primary E2E signal.
- Journey tests are smoke evidence only; they do not close flow coverage gaps.
- A route is covered only when a test reaches the route and asserts URL plus route-specific UI.
- An action is covered only when a test performs it and verifies resulting UI or backend-visible state.
- `covered-by-parent` is only for non-addressable redirects/layout states. If a static route appears directly in E2E URL evidence, add a graph edge.
- Dynamic route edges must include `evidence.urlPattern` and `evidence.assertions`.
- Non-navigation actions must include `evidence.result`.

Graph command output always uses:

```text
verdict: <none|possible|likely|definite|unknown|pass|warning|fail|approval-required>
reason: <short concrete reason>
next: <next action or "none">
```

`graph:check` enforces stale nodes, broken references, missing evidence,
journey-vs-flow separation, and incorrect `covered-by-parent` classifications.

### Patch format

Use `e2e/graph/patch.json` when adding graph coverage. New AI-authored smoke coverage
uses `convention: "journey"` and must set `coverageLevel: "smoke"`.

```json
{
  "nodes": [],
  "edges": [
    {
      "id": "open-service-detail",
      "from": "app-project-tenantGroupId-services",
      "to": "app-project-tenantGroupId-services-id",
      "action": "open service detail",
      "convention": "journey",
      "via": {
        "file": "e2e/support/steps/project-overview.steps.ts"
      },
      "coveredBy": [
        "e2e/tests/journeys/project-overview.spec.ts"
      ],
      "coverageLevel": "smoke",
      "actionType": "open",
      "evidence": {
        "urlPattern": "/app/project/.+/services/.+",
        "assertions": ["Service detail heading"]
      }
    }
  ]
}
```

Patch edge fields:

```text
id             stable unique edge id
from           existing or patch node id where the action starts
to             existing or patch node id where the action lands
action         human-readable action summary
convention     "flow" or "journey"
via.file       helper or spec file that implements the navigation/action
coveredBy      spec file or files that execute the edge
coverageLevel  required as "smoke" for journey edges
actionType     navigate/open/redirect/smoke/login/create/update/delete/etc.
evidence       route or result proof from the actual test
```

Route evidence is required when the target route has any dynamic segment, meaning any
path segment beginning with `:`:

```json
{
  "evidence": {
    "urlPattern": "/resource/.+/detail/.+",
    "assertions": ["Detail page heading"]
  }
}
```

Result evidence is required when `actionType` is more than navigation/open/login:

```json
{
  "actionType": "create",
  "evidence": {
    "urlPattern": "/resource/.+",
    "assertions": ["Created item name"],
    "result": "Created item is visible in the list or can be read from the backend."
  }
}
```

Journey files live in:

```text
e2e/support/steps/<domain>.steps.ts
e2e/tests/journeys/<journey>.spec.ts
```

Flow files are the primary coverage path. Read them freely, but do not modify protected
flow files unless the user explicitly approves:

```text
e2e/tests/flow/
e2e/tests/auth/
e2e/tests/secrets-and-configs/
e2e/support/navigation.ts
e2e/support/console.ts
e2e/support/flow-state.ts
```

If the user approves a flow graph patch, run:

```bash
npm run graph:update -- --allow-flow
```

`graph:update` rejects new edges that do not meet the evidence rules above. Journey
patches stay smoke-only so they cannot be mistaken for primary flow coverage.

Action keywords used by `graph:impact`:

```text
delete cancel invite grant revoke approve reject submit confirm upload sync save create update remove
```

User-action surfaces:

```text
JSX visible text, aria-label, title, placeholder, label, name,
button/link/menu labels, onSubmit/handleDelete-style handler names,
route/action config labels
```

## The flow suite; one project per run

`tests/flow/*` is a **single sequential scenario**, not independent tests. Step 01
creates one project and records its name + `tenantGroupId` in
`fixtures/flow-state.json`; every later step reads that id, so they all act on the
**same** project. Step 99 deletes it again.

```
01 create project (Development + Testing)
02 add environment  (Staging)
03 invite a person  (Development)
04 grant that person access to Testing
05 add an application domain
07..14 route and surface coverage
99 delete the project   <- teardown
```

Because they share state they must run in order, which is why `workers: 1` and the
numeric filename prefixes exist. Running one step alone fails fast with
"run 01-create-project first".

Knobs in `.env.e2e`:

| Variable             | Effect                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_PROJECT_NAME`   | Name for the run's project. **Blank = `e2e-<random>` per run** (recommended; repeated runs never collide). Set a value when you want a predictable project to inspect.            |
| `E2E_KEEP_PROJECT=1` | Skip step 99, leaving the project behind.                                                                                                                                          |
| `E2E_NO_WEBSERVER=1` | Don't auto-start the app; you manage the server.                                                                                                                                   |
| `E2E_PAUSE_MS`       | How long the browser holds after **each** test so you can see the result. Defaults to **10 s in headed mode**, 0 when headless. Set a number to override either way; `0` disables. |
| `E2E_SLOWMO`         | Milliseconds of delay per browser action.                                                                                                                                          |

```bash
E2E_PROJECT_NAME=e2e-demo E2E_KEEP_PROJECT=1 npm run test:headed
```

> Nothing in the suite scans the console for "some `e2e-*` project" any more; a run
> only ever touches the project it created itself.

## Layout

```
e2e/
  tests/auth/login.spec.ts       # login through dev-iam -> /app/console
  tests/flow/01..99              # primary sequential flow coverage
  tests/journeys/                # journey smoke specs
  tests/secrets-and-configs/     # secret/config E2E coverage
  support/steps/                 # journey helper actions and assertions
  support/flow-routes.ts         # flow route assertions
  support/flow-state.ts          # shared project reference between flow specs
  graph/                         # graph source, baseline, generated graph artifacts
  scripts/                       # graph inventory, impact, check, update, render
  fixtures/                      # auth storage state + flow state (gitignored)
  playwright.config.ts           # baseURL + creds from .env.e2e
```

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

## Discovering / updating selectors

The username/password fields live on the dev-iam page. To capture or verify
selectors against the live page:

```bash
npm run codegen -- <E2E_BASE_URL>/login
```

## The flow suite; one project per run

`tests/flow/*` is a **single sequential scenario**, not independent tests. Step 01
creates one project and records its name + `tenantGroupId` in
`fixtures/flow-state.json`; every later step reads that id, so they all act on the
**same** project. Step 06 deletes it again.

```
01 create project (Development + Testing)
02 add environment  (Staging)
03 invite a person  (Development)
04 grant that person access to Testing
05 add an application domain
06 delete the project   <- teardown
```

Because they share state they must run in order, which is why `workers: 1` and the
numeric filename prefixes exist. Running one step alone fails fast with
"run 01-create-project first".

Knobs in `.env.e2e`:

| Variable             | Effect                                                                                                                                                                             |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E_PROJECT_NAME`   | Name for the run's project. **Blank = `e2e-<random>` per run** (recommended; repeated runs never collide). Set a value when you want a predictable project to inspect.            |
| `E2E_KEEP_PROJECT=1` | Skip step 06, leaving the project behind.                                                                                                                                          |
| `E2E_NO_WEBSERVER=1` | Don't auto-start the app; you manage the server.                                                                                                                                   |
| `E2E_PAUSE_MS`       | How long the browser holds after **each** test so you can see the result. Defaults to **10 s in headed mode**, 0 when headless. Set a number to override either way; `0` disables. |
| `E2E_SLOWMO`         | Milliseconds of delay per action, to watch the steps themselves.                                                                                                                   |

```bash
E2E_PROJECT_NAME=e2e-demo E2E_KEEP_PROJECT=1 npm run test:headed
```

> Nothing in the suite scans the console for "some `e2e-*` project" any more; a run
> only ever touches the project it created itself.

## Layout

```
e2e/
  tests/auth/login.spec.ts   # login through dev-iam -> /app/console
  tests/flow/01..06          # the sequential scenario above
  support/flow-state.ts      # shared project reference between steps
  fixtures/                  # auth storage state + flow state (gitignored)
  playwright.config.ts       # baseURL + creds from .env.e2e
```

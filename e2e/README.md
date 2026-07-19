# Blocks OS — End-to-End Tests (Playwright)

E2E tests that drive the real app through the browser, including the dev-iam
login redirect flow.

## One-time setup

1. **Configure env** — copy the template and fill in your values:
   ```bash
   cd e2e
   cp .env.e2e.example .env.e2e
   ```
   Set `E2E_BASE_URL` (your named domain, e.g. `https://dev-os.blocksdevelopers.com:5000`),
   `E2E_USERNAME`, `E2E_PASSWORD`. `.env.e2e` is gitignored — never commit real
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

## Layout

```
e2e/
  tests/auth/login.spec.ts   # login through dev-iam -> /app/console
  fixtures/                  # saved auth storage state (gitignored)
  playwright.config.ts       # baseURL + creds from .env.e2e
```

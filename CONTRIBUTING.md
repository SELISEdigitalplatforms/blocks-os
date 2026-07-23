# Contributing to Blocks OS

Thanks for contributing. This guide covers the day-to-day workflow for this repository. See `README.md` and `LOCAL_GUIDE.md` for environment setup.

## Repository layout

- `server/` — .NET backend (`Api`, `Worker`, and the `*.DomainService` projects). Tests live in `server/XUnitTest`.
- `client/` — React + TypeScript + Vite frontend. Tests are colocated next to the code they cover.
- `.github/workflows/` — CI pipelines (`ci-dev.yml`, `ci-stg.yml`, `ci_prod.yml`).

## Running the tests

Both suites must pass before a PR can merge.

Backend:

```bash
dotnet test server/XUnitTest/XUnitTest.csproj
```

Frontend (from `client/`):

```bash
npm ci
npx vitest run          # single run
npm run test:watch      # watch mode
npm run test:coverage   # with coverage report
```

The frontend runner is configured in `client/vitest.config.ts` (separate from `vite.config.ts`).

## Continuous integration

On pull requests, the `RUN_TESTS` flag enables PR-only jobs that run the backend suite (via the shared reusable workflow, which handles private NuGet auth) and the frontend suite (`npx vitest run`). Keep both green.

## Naming conventions

Follow the documented conventions when adding code:

- Frontend: `client/NAMING-CONVENTIONS.md`
- Backend: `server/NAMING-CONVENTIONS.md`

These are documentation only for now; there is no lint/analyzer enforcement yet.

## Backward-compatible renames

The public API and wire contract are consumed by other services and clients. When renaming anything public, keep the old form working:

- C# method/type: keep the old symbol, mark it `[Obsolete("Renamed to <New>.")]`, and forward to the new one.
- C# route/action: add the new action, keep the old one marked `[Obsolete]` delegating to the new, never delete a route.
- JSON field: add the correctly-named member and keep accepting the old name.
- TypeScript export: `/** @deprecated use <new> */ export const oldName = newName;`.
- Permission scopes are grant-breaking: never silently change a scope string; changes need a coordinated per-tenant grant migration.

# Contributing to Blocks OS

Thanks for contributing. This guide covers the day-to-day workflow for this repository. See `README.md` for environment setup.

## Branch model

- `main`: production-ready code (protected)
- `dev`: integration branch (protected); all pull requests target `dev`
- `inception`: the working branch; day-to-day work happens here

Never commit directly to `dev` or `main`. Work on `inception` and open a pull request from `inception` into `dev`. Do not force-push and do not rewrite published history.

## Commit conventions

Match the style already in the log. Most commits use Conventional Commits (`type(scope): subject`, for example `test(client): ...`, `chore(e2e): ...`); a plain imperative subject is also used for straightforward changes. Keep the subject concise and explain the what and the why in the body when it is not obvious.

## Reporting a security issue

Do not open a public issue for a suspected vulnerability. Follow the private disclosure process in [SECURITY.md](SECURITY.md).

## Repository layout

- `server/`: .NET backend (`Api`, `Worker`, and the `*.DomainService` projects). Tests live in `server/XUnitTest`.
- `client/`: React + TypeScript + Vite frontend. Tests are colocated next to the code they cover.
- `.github/workflows/`: CI pipelines (`ci-dev.yml`, `ci-stg.yml`, `ci_prod.yml`).

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

Follow the conventions the code already uses when adding code. There is no lint/analyzer enforcement of these yet:

- Backend (C#): interfaces are `I`-prefixed; types and public members are PascalCase; parameters and locals are camelCase; private fields are `_camelCase`; `Task`-returning methods carry the `Async` suffix; request/response DTOs end in `Request`/`Response`.
- Frontend (TypeScript): files and folders are kebab-case (`use-*.ts` hooks, `*.service.ts` services); types and React components are PascalCase; variables and functions are camelCase.

## Backward-compatible renames

The public API and wire contract are consumed by other services and clients. When renaming anything public, keep the old form working:

- C# method/type: keep the old symbol, mark it `[Obsolete("Renamed to <New>.")]`, and forward to the new one.
- C# route/action: add the new action, keep the old one marked `[Obsolete]` delegating to the new, never delete a route.
- JSON field: add the correctly-named member and keep accepting the old name.
- TypeScript export: `/** @deprecated use <new> */ export const oldName = newName;`.
- Permission scopes are grant-breaking: never silently change a scope string; changes need a coordinated per-tenant grant migration.

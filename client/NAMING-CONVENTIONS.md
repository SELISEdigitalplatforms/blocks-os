# React / Client Naming Conventions

Reference for the `client/` (React + TypeScript + Vite) codebase. This document records the conventions the code already follows so new code stays consistent. It is documentation only; there is no CI/lint enforcement of these rules yet (a separate ticket covers enforcement).

## Files and folders

- **Files:** kebab-case. Examples: `project.service.ts`, `use-services.ts`, `navigation-menus.ts`, `traces-overview.tsx`.
- **Folders:** kebab-case. Examples: `cross-modules/`, `secret-management/`, `traces-overview/`.
- **Role suffixes in filenames** signal what the file is:
  - `*.service.ts` — API/data service module.
  - `*.constant.ts` — constant/config module.
  - `*.util.ts` — pure helpers.
  - `*.test.ts` / `*.test.tsx` — unit tests, colocated next to the unit under test.
  - `use-*.ts` — React hooks.
- **One component per file**, filename in kebab-case matching the component (`traces-overview.tsx` exports `TracesOverview`).

## Identifiers

- **Components:** PascalCase (`TracesOverview`, `SecretManagement`).
- **Hooks:** camelCase starting with `use` (`useServices`).
- **Functions / variables:** camelCase (`getRuntimeEnv`, `apiProxyTarget`).
- **Types / interfaces / enums:** PascalCase (`GroupedProjectsDto`). Do not prefix interfaces with `I`.
- **Constants (module-level literals):** SCREAMING_SNAKE_CASE for fixed maps/config (`API_BASES`, `QUOTA_REDIRECT_CONFIG`); camelCase for derived values.

## Path aliases

Import via the configured aliases rather than long relative paths:

- `@` -> `./app`
- `@blocks-lmt` -> `./app/cross-modules/lmt`
- `@blocks-storage`, `@blocks-communication`, `@blocks-identifier`, `@blocks-localization`, `@blocks-utilities`, `@blocks-ai` -> the matching `cross-modules/*` folder

Aliases are defined in both `vite.config.ts` and `vitest.config.ts`; keep the two lists in sync when adding a module.

## Wire / product terms

- Use the customer-facing product term in user-visible strings, routes, and public request/response shapes. "Project" is the customer term; "tenant group" is internal only.
- "My Services" (plural) is the customer app-registration surface at `/app/secret-management/my-services`; "Managed Services" is the separate platform-capability taxonomy.
- When renaming an exported symbol that other modules consume, keep the old name as a forwarding alias:
  `/** @deprecated use newName */ export const oldName = newName;`

## Tests

- Test files live next to the code they cover and end in `.test.ts(x)`.
- Vitest runs with `globals: true`, so `describe`/`it`/`expect` need no import.
- Scripts: `test` (single run), `test:watch`, `test:coverage`. The runner config lives in `client/vitest.config.ts`.

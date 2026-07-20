# .NET / Server Naming Conventions

Reference for the `server/` (.NET) codebase. This document records the conventions the code already follows so new code stays consistent. It is documentation only; there is no analyzer/editorconfig enforcement of these rules yet (a separate ticket covers enforcement).

## Namespaces and projects

- **Root namespace / product identity:** `BlocksOs` (the product is Blocks OS; the wire `ServiceName` is `blocks-os`). Do not introduce `BlocksTemplate` or `blocks-idp` in new code.
- **Domain-service projects:** `<Area>.DomainService` (e.g. `Identifier.DomainService`, `CloudConfiguration.DomainService`, `Secrets.DomainService`).
- **Namespaces are PascalCase and mirror the folder path**, e.g. `BlocksOs.Api.Controllers`, `CloudConfiguration.DomainService.Notification.RequestModel`.

## Types

- **Classes, interfaces, enums, records:** PascalCase.
- **Interfaces** are prefixed with `I` (`IProjectRepository`, `IConfigurationService`).
- **Controllers** end in `Controller` (`ProjectController`); the route template is `[controller]/[action]`.
- **Services / repositories** end in `Service` / `Repository` and pair with an `I`-prefixed interface.
- **DTOs:** request models end in `Request` (`UpdateProjectGroupRequest`, `SaveNotificationConfigurationRequest`); response models end in `Response`. A request model that is missing the suffix is a defect to correct.

## Members

- **Public members, methods, properties:** PascalCase.
- **Async methods** end in `Async` (`SaveProjectAsync`, `GetMailConfigurationAsync`).
- **Private fields:** `_camelCase` (`_configurationService`, `_projectManagementService`).
- **Parameters and locals:** camelCase.
- Watch for misspellings that leak onto the wire: `Enviroment` -> `Environment`, `Notificaton`/`Notificatoin` -> `Notification`. Fix them, but keep the old JSON member accepted for backward compatibility when it is already on a public payload.

## Permission scopes

- Grammar is three kebab-case segments: `service::area::action`, e.g. `blocks-os::project::mutate-project`, `blocks-os::log::gets`.
- Derive the `service` segment from the corrected service identity (`blocks-os`), not a hardcoded stale string.
- Changing an existing scope string is grant-breaking: it requires a coordinated per-tenant catalog seed/grant migration shipped with the code. Prefer additive scopes over silent renames.

## Backward-compatible renames

When a public symbol, route, or wire field must be renamed, keep the old one working:

- **Method/type:** keep the old symbol, mark `[Obsolete("Renamed to <New>.")]`, and forward its body to the new one.
- **Controller route/action:** add the new `[Http*("new-route")]` action; keep the old one, mark it `[Obsolete]` with a `// Deprecated: use <new route>` comment, and delegate to the new action.
- **JSON field:** add the correctly-named member and keep accepting the old name mapped to the new one.

## Tests

- Backend tests live in `server/XUnitTest`. Run with `dotnet test server/XUnitTest/XUnitTest.csproj`.

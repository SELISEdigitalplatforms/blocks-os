# Blocks OS — Technical Specification

> Scope: the `blocks-os` repository — the central console / control-plane of the SELISE Blocks platform.
> Status: derived from the current code, corrected against the authoritative product decisions captured in answered tickets (#279, #323–#341). Where the code and a decision disagree, the decision is the **target** and the gap is called out inline as **Gap**.
> Canonical product name: **Blocks OS** (confirmed: `client/index.html` `<title>`, `appsettings.json` `SwaggerOptions.Title`, `client/app/constants/blocks-products.ts`).
> Canonical customer terminology used throughout: **Project** (top-level container, backed by a tenant group), **Environment** (one isolated tenant within a project), **People** (project collaborators), **My Services** (a customer's own registered backend services), **Managed Services** (platform capabilities — a separate taxonomy, per #329), **Logs & Traces** (the observability area, renamed from "LMT" per #339).

---

## 1. Technology Stack

### Backend
- **Runtime:** .NET 10 (`net10.0`; `DOTNET_VERSION` default `10.0.x` in CI, `<TargetFramework>net10.0</TargetFramework>`).
- **Web:** ASP.NET Core Web API (controllers), Swagger/OpenAPI (`SwaggerOptions`, bearer auth enabled).
- **Shared platform SDK:** `SeliseBlocks.Genesis` 10.1.0 — supplies cross-cutting primitives used everywhere: `BaseEntity`, `BaseResponse` / `BaseMutationResponse`, `BlocksContext` (tenant/user context), the `[ProtectedEndPoint("scope")]` authorization attribute, message-bus abstractions (`IConsumer<T>`, `MessageConfiguration`, Azure Service Bus / RabbitMQ), and configuration/secret/vault bootstrapping (`ApplicationConfigurations`, vault types OnPrem/Azure).
- **Config drivers:** `SeliseBlocks.ConfigurationDriver` 10.0.0-preview.1 (Mongo-backed configuration via `AddMongoDbConfiguration`), `SeliseBlocks.StorageDriver` 9.0.0-preview.16 (object storage), `SeliseBlocks.MailDriver` 10.0.0-preview.1 (mail send).
- **Data access:** `MongoDB.Driver` 3.8.0 (documents modeled with `[BsonIgnoreExtraElements]`).
- **Validation:** `FluentValidation` 12.0.0 (+ `FluentValidation.AspNetCore` 11.3.0) — used for `CreateProjectRequest`, `UpdateProjectRequest`, `RegisterServiceRequest`, configuration requests.
- **Infra/provisioning:** `Azure.ResourceManager.ServiceBus` 1.1.0 (per-service Service Bus topic/subscription creation), `SSH.NET` 2024.2.0 (remote nginx reverse-proxy + certbot provisioning for custom domains), `SixLabors.Fonts` 2.1.2.
- **Realtime:** SignalR is consumed on the client (`@microsoft/signalr`) for live log tailing / migration notifications.

### Frontend
- **Framework:** React 18.3 + TypeScript 5.7, built with **Vite 6** (`client/vite.config.ts`).
- **Routing:** `react-router-dom` 6.28 (single `createBrowserRouter` tree in `app/router.tsx`).
- **Server state:** `@tanstack/react-query` 5.62; **client state:** `zustand` 5 (incl. `store/impersonate-store.ts`).
- **UI:** Radix UI primitives + Tailwind CSS 3.4 + `class-variance-authority`, `lucide-react`, `sonner`, `framer-motion`; shared design system via `@seliseblocks/blocks-kit`.
- **Forms/validation:** `react-hook-form` 7.53 + `zod` 3.23 (`@hookform/resolvers`).
- **Other notable libs:** `@microsoft/signalr` (live logs), `jwt-decode`, `@hcaptcha/react-hcaptcha`, `@beefree.io/sdk` + `@mailupinc/bee-plugin` (email-template editor), `react-syntax-highlighter`, `@tanstack/react-table`.
- The built client is emitted into `../server/Api/wwwroot` and served by the API as a SPA fallback (`Program.cs` `MapFallbackToFile("/index.html")`).

### Data store & infra
- **Primary store:** MongoDB — one **root/platform DB** (`RootDatabaseName`, holds `Secrets`, and a `BlocksConfiguration`-style source used to seed tenants) plus **one database per tenant/environment**.
- **Messaging:** Azure Service Bus (default) or RabbitMQ (`amqp`/`amqps` connection string auto-detected in `IdentifierConstants.GetProvider`).
- **Secrets/vault:** Genesis vault (OnPrem or Azure), plus a Mongo `Secrets` document (`SecretKey` `blocks-secret-os`) that also carries frontend runtime settings.
- **Deployment:** Docker (`Dockerfile` for API+client, `Dockerfile.worker` for the worker), Azure AKS, GitOps via `blocks-inventory` reusable workflows; SonarQube + SCA (Dependency-Track) in CI.

---

## 2. Solution / Module Structure

The .NET solution is `server/BlocksOS.sln` (README references to `Blocks.slnx` are stale — see #331). It contains **9 projects**:

| Project | Responsibility |
|---|---|
| **Api** | ASP.NET Core host. Controllers, `Program.cs` bootstrap, global `api` route prefix (`GlobalApiRoutePrefixConvention`), SPA hosting, frontend-runtime token injection (`ApplyFrontendRuntimeSettings`), DI wiring for all domain services. |
| **Identifier.DomainService** | Core control-plane domain. Sub-areas: `Project` (project/tenant provisioning, `ProjectManagementService`, `ProjectRepository`, validators), `People` (invitations, access, ownership), `ManagedService` (register "My Services"), `Certificate` (tenant signing certs; Azure KeyVault / local / Mongo storage backends), `Subscription` (usage), `Shared` (entities, DTOs, `IdentifierConstants`, `DomainMangementService` for custom domains). |
| **Cloud.DomainService** | API-endpoint security configuration (`ApiEndpointConfigService`) — per-endpoint allow/deny, roles, MFA/captcha, rate limit. |
| **Cloud.LmtService** | Query/analytics side of observability: `LogService`, `TraceService`, operational/service analytics over Mongo. |
| **CloudConfiguration.DomainService** | Per-tenant provider configuration: `Mail`, `Storage`, `Notification` (single `IConfigurationService`). |
| **Secrets.DomainService** | Per-tenant secrets vault (`SecretManagementService`, `SecretRepository`). |
| **Worker** | Background message consumers (project configuration, domain binding, restore, resource-usage, user creation) + a periodic ping health service. |
| **LmtManagedServiceWorker** | Ingestion side of observability: subscribes to each registered service's log/trace queues (Service Bus / RabbitMQ) and batch-writes to Mongo (`LmtWorker`, `LmtMongoPersistence`). |
| **XUnitTest** | Backend unit tests. |

**On-disk but NOT in the solution / empty stubs:** `Authentication.DomainService`, `Captcha.DomainService`, `Captcha.Driver`, `Iam.DomainService`, `Iam.Driver`, `Mfa.DomainService`, `Mfa.Driver` — each contains **zero** `.cs` files. Identity/MFA/captcha logic lives in the sibling services (blocks-iam, "Blocks Logic"); these folders are placeholders only.

**Client (`client/app/`):**
- `router.tsx` — the whole route tree; `main.tsx` — entry.
- `pages/` — top-level screens (console, create-project, environments, people, repositories, settings, subscription-usage, dashboard, lmt).
- `routes/` — auth, callback (GitHub / OIDC), dashboard sub-routes (secret-management, idp, api-settings, lmt).
- `cross-modules/` — feature modules aliased for reuse: `lmt`, `storage`, `communication`, `identifier`, `localization`, `utilities`, `ai`, `devops`.
- `idp/` — the identity/access admin section (roles, permissions, OIDC, SSO, identity providers, settings), largely calling **blocks-iam**.
- `constants/`, `services/`, `store/`, `hooks/`, `guards/`, `layouts/`, `providers/`, `components/`.

---

## 3. API Surface

All routes are `/api/{Controller}/{Action}` (`GlobalApiRoutePrefixConvention` prepends `api`; `[Route("[controller]/[action]")]`). Authorization uses Genesis `[ProtectedEndPoint("scope")]` (permission-scoped) or plain `[Authorize]` (authenticated only). Tenancy is carried by the `X-Blocks-Key` header (see §5).

### ProjectController — `blocks-os::project::*`
| Action | Verb | Scope | Request → Response |
|---|---|---|---|
| Create | POST | `mutate-project` | `CreateProjectRequest` → `CreateProjectResponse` |
| Gets | GET | `projects` | `GetProjectsRequest` → `List<GroupedProjectsDto>` |
| Get | GET | `projects` | — → `GetProjectResponse` |
| Restore | POST | `restore-project` | `RestoreProjectRequest` → `RestoreProjectResponse` |
| UpdateProject | POST | `mutate-project` | `UpdateProjectRequest` → `BaseResponse` |
| UpdateTenantGroup | POST | `mutate-project` | `UpdateTenantGroupRequest` → `BaseResponse` |
| Disable | POST | `delete-project` | `DisableProjectRequest` → `BaseResponse` |
| GetAsset | GET | `asset` | `GetAssetRequest` → `GetAssetResponse` |
| AddAsset | POST | `add-asset` | `AddAssetRequest` → `BaseResponse` |
| UpdateTokenValidationParameters | POST | `mutate-token-validation-params` | request → `BaseResponse` |
| GetTokenValidationParameters | GET | `token-validation-params` | request → `IActionResult` |
| SaveThirdPartyJWTClaims | POST | `mutate-3rd-party-claims` | request → `SaveThirdPartyJWTClaimsResponse` |
| GetThirdPartyJWTClaims | GET | `3rd-party-claims` | — → `ThirdPartyJWTClaims?` |

**Decided target — `UpdateTenantGroup` (#330):** rename this customer-facing endpoint/route/DTO off the "tenant group" term to **Project** (customer-facing term), coordinated backend+frontend in one change (API is consumed only inside this repo, so no external deprecation cycle). Internal service/repository/persistence identifiers may keep `TenantGroup`. Track the `tenantGroupId`/`TenantGroupId` query-param casing mismatch (`project.service.ts`) separately.

### PeopleController — `blocks-os::people::*`
| Action | Verb | Scope | Request → Response |
|---|---|---|---|
| Invite | POST | `invite` | `InviteRequest` → `InviteResponse` |
| RemoveAccess | POST | `remove-access` | `RemoveAccessRequest` → `IActionResult` |
| Gets | POST | `gets` | `GetPeoplesRequest` → `GetPeoplesResponse` |
| ResendInvitation | POST | `resend` | `ResendInvitationRequest` → `IActionResult` |
| ConfirmInvitation | POST | **none (implicit)** | `ConfirmInvitationRequest` → `IActionResult` |
| TransferOwnerShip | POST | `transfer-owner` | `TransferOwnershipRequest` → `IActionResult` |

**Decided target — `ConfirmInvitation` (#327):** its authorization intent must be made **explicit** — `[AllowAnonymous]` if the confirm-invitation page is meant to be public, otherwise a scoped attribute. Today it has neither, which is the defect. **Gap:** currently no attribute at all.
**Decided target — `TransferOwnerShip` (#333):** route naming is tracked as a separate People-API ticket with a compatibility decision (not a blocking rename here).

### ServiceController ("My Services") — `blocks-os::service::*`
| Action | Verb | Scope | Request → Response |
|---|---|---|---|
| Register | POST | `register` | `RegisterServiceRequest` → `IActionResult` (`RegisterServiceResponse`) |
| GetAll | POST | `gets` | `GetAllServiceRequest` → `GetAllServiceResponse` |

### StorageController — `blocks-os::storage::*`
| Action | Verb | Scope | Notes |
|---|---|---|---|
| Save | POST | `mutate` | `SaveStorageConfigurationRequest` → `BaseMutationResponse` |
| Gets | GET | `gets` | → `List<StorageConfiguration>` |
| Get | GET | `gets` | → `StorageConfiguration` |
| Delete | POST | `mutate` | `DeleteStorageConfigurationRequest` → `BaseResponse` |

**Decision (#332):** `Delete` staying POST with a `mutate` scope is an **accepted standard** (save-access implies delete); no verb/scope change.

### MailController — `blocks-os::mail::*`
| Action | Verb | Scope | Notes |
|---|---|---|---|
| Save | POST | `save` | `MailConfiguration` → `IActionResult` |
| Get | GET | `gets` | `GetMailConfigurationRequest` → `MailConfiguration` |
| Gets | GET | `gets` | → `List<MailServerConfiguration>` |
| Delete | DELETE | `delete` | `IActionResult` |
| Duplicate | POST | `save` | `IActionResult` |

**Decided target — `Get`/`Gets` (#328):** confirmed defect. `Get` returns **HTTP 500** (unguarded `NullReferenceException` in `ConfigurationService.GetMailConfigurationAsync` ~:256), not "200 with null body"; the discarded `BadRequest(...)` return value is dead. Fix: change `Get`/`Gets` return type to `Task<IActionResult>` (to match working siblings) **and** add the null-guard in the service (the return-type change alone does not fix the 500); use **404** for not-found; delete the unreachable null branch in `Gets`. Note `MailConfiguration` is a request/config model missing the `*Request` suffix, not an entity.

### NotificationController — `blocks-os::notification::*`
| Action | Verb | Scope |
|---|---|---|
| Save | POST | `save` |
| Gets | GET | `gets` |
| Get | GET | `gets` |
| Delete | DELETE | `delete` |

**Decided target (#333, split out):** the request-type typos `SaveNotificatonConfigurationRequest` / `DeleteNotificatoinConfigurationRequest` / `GetNotificatoinConfigurationAsync` are a separate backend-cleanup ticket; `NotificationResponse` is dead-code removal.

### LogController — `blocks-os::log::*` (target)
| Action | Verb | Current scope | Target scope (#279) |
|---|---|---|---|
| GetLogs | POST | `blocks-os::mail::gets` | `blocks-os::log::gets` |
| GetLogsByDate | POST | `blocks-os::mail::gets` | `blocks-os::log::gets` |
| Live | GET | `blocks-os::mail::gets` | `blocks-os::log::gets` (optionally split `blocks-os::log::get-live`) |

**Decided target — #279 (confirmed bug):** all three endpoints are wrongly gated by a **mail** scope. The fix must ship **two coordinated parts together** because the platform is multi-tenant: (1) update the three `[ProtectedEndPoint]` attributes to `blocks-os::log::gets`, and (2) a per-tenant DB seed/migration that registers `blocks-os::log::gets` in every tenant's permission catalog and grants it to roles currently holding `blocks-os::mail::gets` — otherwise every tenant loses log access on deploy. **Open / undecided:** whether `Live` gets its own `blocks-os::log::get-live` scope or all three share one.

### TraceController — `blocks-os::trace::*`
| Action | Verb | Scope | Current return | Decided return (#332) |
|---|---|---|---|---|
| GetTraces | POST | `gets` | `Task<object>` | **concrete type** (so Swagger documents a schema) |
| GetTrace | GET | `gets` | `Task<object>` | **concrete type** |
| GetOperationalAnalytics | POST | `get-analytics` | `Task<object>` | stays `Task<object>` (genuinely dynamic) |
| GetServiceAnalytics | POST | `get-analytics` | `Task<object>` | stays `Task<object>` (genuinely dynamic) |

### ApiEndpointConfigController — `[Authorize]` only
| Action | Verb | Auth |
|---|---|---|
| GetList | POST | `[Authorize]` |
| Update | POST | `[Authorize]` |
| BulkUpdate | POST | `[Authorize]` |

**Decision (#327):** the `[Authorize]`-only (unscoped) behavior here **is intentional for now**; any move to scoped authz is a separate permission-standardization issue.

### DomainController — `[Authorize]` only
| Action | Verb | Auth | Request → Response |
|---|---|---|---|
| Configure | POST | `[Authorize]` | `ConfigureDomainRequest` → `BaseResponse` |

**Decision (#327):** `[Authorize]`-only is intentional for now.

### SecretsController — `[Authorize]` only
| Action | Verb | Auth |
|---|---|---|
| Save | POST | `[Authorize]` |
| Gets | GET | `[Authorize]` |
| Get | GET | `[Authorize]` |
| Delete | POST | `[Authorize]` |

**Decision (#327):** **do not** add fine-grained scopes here in isolation — secrets are high-risk and the whole controller (API shape, authz model, frontend, docs, default grants, tests) is deferred to a dedicated **Secrets Management Epic**. The UI is currently disabled in the router.

### Cross-cutting API conventions (decided)
- **Permission-scope grammar (#334):** canonical form is **`service::area::action`** (3 segments); action segment is **kebab-case**; the prefix is **derived from a `ServiceName` constant**, not hardcoded. blocks-os is already 3-segment kebab-case; its migration is to derive the prefix from the corrected service identity and is **sequenced behind the identity fix #331** (the non-breaking case where the derived value equals the current `blocks-os` string).
- **Response envelope (#336):** the single canonical envelope is owned by **`SeliseBlocks.Genesis`**. It is extended **additively** — `IsSuccess`, `Errors`, `ItemId` unchanged; a new **optional** `ValidationErrors` field (field, code, message, severity) is added, mapping FluentValidation while still filling `Errors`. No per-repo envelopes; ships as a new Genesis version adopted in lockstep. Do **not** rename `IsSuccess` or change the `Errors` type.
- **Consistency-only renames are NOT actioned (#332):** the mixed list-action names (`Gets`/`GetAll`/`GetList`), read-only endpoints using POST, and scope noun-vs-verb inconsistencies stay as-is (breaking URLs/re-grants with no functional benefit).

---

## 4. Data Model

Documents derive from Genesis `BaseEntity` (id, tenant, audit fields) and are `[BsonIgnoreExtraElements]`. Key collections:

- **Tenant** (`Tenants` collection) — one document per **environment**; carries signing certificates, DB, domain, environment tier. (Genesis type; also read/written as `Project` in code — see naming note.)
- **Project** (`DomainService.Entities.Project`, stored in the `Tenants` collection) — per-environment record: `Name`, `TenantId`, `TenantGroupId`, `Environment`, `IsDomainVerified`, `CookieDomain`, `IsCookieEnable`, `CustomDomain`, `IsDisabled`, `Applications`. The `TenantGroupId` links all environments of one **Project** (the customer-facing "Project").
- **TenantAsset** (`TenantAssets`) — `TenantGroupId` + `List<Resource>` (connected GitHub repositories/assets).
- **ProjectPeople** (`ProjectPeoples`) — per-environment collaborator grant: `UserId`, `Email`, `TenantId`, `IsInvitationSent`, `IsInvitationConfirmed`, **`IsCreator`** (the Owner flag — ownership is a boolean, not a stored role), `Roles` (default `["user"]`).
- **BlocksManagedService** — a customer's registered "My Service": `Name`, `TenantId`, `ServiceId`, `ServiceType` (`Api`/`Worker`/`None` — `BlocksManagedServiceType`), `Metadata`, `ServiceBusConnectionString` (scoped telemetry credential).
- **ResourceLimit** (`ResourceLimits`) — **data-driven, per-tenant** quota: `Resource`, `ResourceType`, `Limit`, `Usage`, `Lifetime`, `IsActive`, `EnableAutoRenew`, `TenantId`, `Type`. This is the authoritative source of enforced limits (#325) — limits are **not** hardcoded, which is why they can become subscription-based later without code change.
- **ProjectStatusTracer** (`ProjectStatusTracers`) — resumable async-provisioning progress: `IsCertificatesUploaded`, `IsProjectUpdated`, `IsDefaultConfigurationCopied`, `InsertedIntoProjectPeople`, `IsProjectCreationSuccess`, `ErrorMessage`.
- **TenantCertificate**, **ThirdPartyJWTClaims** (`ThirdPartyJWTClaims`), **SignUpSetting**, **BlocksGuid**.
- **Observability collections:** the ingestion worker writes **logs keyed by service name** and **traces keyed by tenant id** into per-collection Mongo documents (`LmtMongoPersistence.SaveLogsAsync` / `SaveTenantBatchesAsync`).

### Per-tenant isolation
- Every environment is a **separate tenant with its own MongoDB database**. Tenant-scoped documents carry `TenantId`; the active tenant is resolved from the `X-Blocks-Key` header via Genesis `BlocksContext`.
- On project creation, a platform **source database** (`BlocksConfiguration`-style) is copied into each new tenant DB (`ProjectRepository.CopyDefaultConfiguration...`): `MailServerConfigurations`, `EmailTemplates`, `StorageConfigurations`, `BlocksLanguages`, `UilmFiles`, `BlocksLanguageModules`, `BlocksLanguageKeys`, `Roles`, `Permissions`, `SchemaDefinitions`, `TenantConfigurations`, `IdentityConfigurations` (customized), `LinkBasedActionConfigs`, `DmsArtifacts`.
- **Gap (#325 Issue B):** the `ResourceLimits` seed is **disabled** — `CopyAndCustomizeResourceLimitsAsync` is commented out at `ProjectRepository.cs:314`. The method exists (`:352`) but is not invoked, so new tenants are provisioned without seeded resource limits. Decided fix: re-enable it (one PR, tracked as Issue B).

---

## 5. Authentication & Authorization

- **Identity provider:** all user authentication is delegated to **blocks-iam** over OIDC/OAuth2. The client runs the OIDC login/callback flow (`routes/auth`, `routes/callback`) against `BLOCKS_IAM_BASE_URL` with `BLOCKS_OS_CLIENT_ID`; the API validates bearer JWTs (Swagger `EnableBearerAuth: true`). Blocks OS holds **no** user/credential store of its own.
- **Tenancy:** the active tenant/environment is selected by the **`X-Blocks-Key`** header (the environment key surfaced to customers in Environment Overview). Genesis resolves it into `BlocksContext` (`BlocksContext.GetContext()?.TenantId`), which scopes DB access and is read directly by controllers (e.g. `ProjectController.Disable`, token-validation endpoints).
- **Impersonation:** entering an environment "impersonates" that tenant client-side (`store/impersonate-store.ts`) to open its per-environment admin console; subsequent calls carry that environment's `X-Blocks-Key`.
- **Authorization model:** Genesis `[ProtectedEndPoint("service::area::action")]` checks the caller's granted permission scopes; `[Authorize]` requires only authentication. Roles/permissions themselves are managed in blocks-iam and **seeded per tenant** on project creation.
- **Ownership:** project **Owner** = the creator (`ProjectPeople.IsCreator`), a boolean rather than a role; Invite / RemoveAccess / TransferOwnership are Owner-gated at the service layer.
- **Invitation links:** the People-invitation link expiry is **hardcoded at 1 hour and intentionally not configurable** (#324) — no owner/operator knob. This is a **different value** from the activation-email expiry.
- **Permission seeding boundary (#326):** `blocks-os::*` permission definitions are handled **outside** this repo; blocks-os does not maintain its own permission-seed folder. (Exception: the #279 log-scope fix requires a coordinated per-tenant grant migration.)
- **Service identity (#331) — Gap:** the backend still self-identifies as **`blocks-idp`** (`appsettings.json` `SwaggerOptions.ServiceName: "blocks-idp"`; root namespaces `DomainService.*` / `Identifier.DomainService`), even though `Program.cs` already sets `serviceName = "blocks-os"`. Decided target: align Swagger `ServiceName`, root namespace, and controller namespaces to **blocks-os**, then derive the permission prefix from the corrected identity. The client `@blocks-idp/*` path alias, the `blocks-idp::read-users` test scope, and the README `Blocks.slnx` reference are split into separate cleanup tickets.

---

## 6. Integrations & Dependencies

### Sibling Blocks services
Base URLs, OAuth client-ids, and callbacks for every sibling are injected at deploy time into the built client (`Program.cs` `ApplyFrontendRuntimeSettings`, tokens like `__BLOCKS_IAM_BASE_URL__`) and consumed via `client/app/constants/endpoint.constant.ts` (`API_BASES`):
- **blocks-iam** — identity/access. The console's Roles, Permissions, Users, Organizations, OIDC, SSO, Identity Providers, Client Credentials, Signup screens call `API_BASES.IAM` (`BLOCKS_IAM_BASE_URL`) directly. blocks-os provisions default roles/permissions/identity config into new tenants and creates users by publishing to the IAM queue.
- **blocks-data** — dynamic-schema data gateway. blocks-os seeds `SchemaDefinitions`/`TenantConfigurations` and enqueues data cleanup/migration.
- **blocks-localization** — seeds `BlocksLanguages`/`UilmFiles`/`BlocksLanguageModules`/`BlocksLanguageKeys`; environment data migration can move language data.
- **blocks-monitor** — a `BLOCKS_MONITOR_BASE_URL` exists; overlaps with the in-console Logs & Traces area (see §7 / §10).
- **"Blocks Logic"** (`API_BASES.LOGIC`, `BLOCKS_LOGIC_BASE_URL`) — backs the **MFA** and **captcha** configuration screens (these are *not* served by blocks-os or blocks-iam).
- Other federated products (login carousel + runtime env): **Construct** (SDK/CLI), **Cloud Build / Release**, **Agents/AI**, **Studio**, **Utilities** — each with its own base URL + client id.

### External services
- **GitHub** — OAuth connect + repository listing/linking (`cross-modules/devops`, GitHub callback route, `BLOCKS_GITHUB_SSO_CLIENT_ID`).
- **Azure Service Bus / RabbitMQ** — messaging (auto-selected).
- **Azure Key Vault** — certificate storage backend option.
- **SSH + nginx + Let's Encrypt/certbot** — custom-domain provisioning on remote reverse-proxy hosts (`DomainMangementService`, `SSH.NET`; certbot email `devsecops@selisegroup.com`, remote nginx templates in `IdentifierConstants`).
- **hCaptcha / reCAPTCHA** — `BLOCKS_GOOGLE_SITE_KEY`, `@hcaptcha/react-hcaptcha`.

### Packages that matter
- Backend: `SeliseBlocks.Genesis` 10.1.0, `SeliseBlocks.ConfigurationDriver`, `SeliseBlocks.StorageDriver`, `SeliseBlocks.MailDriver`, `MongoDB.Driver` 3.8.0, `FluentValidation` 12, `Azure.ResourceManager.ServiceBus`, `SSH.NET`.
- Frontend: `@seliseblocks/blocks-kit`, `react-router-dom` 6, `@tanstack/react-query`, `zustand`, `@microsoft/signalr`, Radix UI, Tailwind, `react-hook-form`+`zod`.

**Shared-client-lib direction (#335):** shared `client/app/lib/*.ts` should migrate into **`blocks-kit`** as a configurable shared base (Epic; per-file PRs) — `domain.ts` → `error.ts` → `http-client.ts` → `utils.ts` → env/path helpers, with drift classification required for divergent files.

---

## 7. Messaging / Eventing

Message-bus configuration is centralized in `IdentifierConstants.GetMessageConfiguration` (Azure Service Bus by default; RabbitMQ when the connection string is `amqp(s)`).

### Queues / topics
| Name | Purpose |
|---|---|
| `blocks_project_listener` | Project/environment provisioning work (consumed by the Worker). |
| `blocks_generic_migration_listener` | Generic environment data-migration jobs. |
| `blocks_data_cleanup_listener` | blocks-data cleanup on disable/restore. |
| `blocks_uilm_environment_data_migration_listener` | Localization/UILM environment data migration. |
| `blocks_iam_listener_user` | User creation requests published to blocks-iam. |
| `blocks_email_listener` | Outbound email (invitations, etc.). |
| `migration_topic` (topic) | Migration-completion signalling. |

The Service Bus config subscribes the service to the project, generic-migration, and data-cleanup queues and publishes to `migration_topic`; the RabbitMQ config binds the same three queues.

### Worker consumers (`server/Worker/Consumers/Identifier/`)
| Consumer | Message | Role |
|---|---|---|
| `ConfigureProjectConsumer` | `Tenant` | Finishes async project setup: generates certificates, inserts creator into `ProjectPeople` (`IsCreator=true`), copies default configuration into the tenant DB, updates `ProjectStatusTracer` (resumable). |
| `DomainConfigureConsumer` | `ConfigureDomainRequest` | Provisions custom-domain nginx vhost + certbot over SSH. |
| `DisableDomainBindingConsumer` | `DisableDomainBindingRequest` | Tears down a domain binding. |
| `RestoreProjectConsumer` | `RestoreProjectRequest` | Restores a disabled project. |
| `UpdateResourceUsageConsumer` | `UpdateResourceUsageCommand_Identifier` | Updates per-tenant `ResourceLimit.Usage`. |
| `CreateUserByEmailPostConsumer` | `CreateUserByEmailPostEvent` | Post-processing after IAM user creation by email (invitation flow). |

A `PeriodicPingBackgroundService` provides worker liveness.

### Telemetry ingestion (`LmtManagedServiceWorker`)
Each registered "My Service" gets a Service Bus topic + log/trace subscriptions (or RabbitMQ channels). `LmtWorker` consumes those streams and `LmtMongoPersistence` batch-inserts logs (keyed by service name) and traces (keyed by tenant id) into Mongo. This is the ingest half; `Cloud.LmtService` serves the query/analytics half.

---

## 8. Configuration & Environments

- **Env resolution:** `ApplicationConfigurations.ResolveVaultType()` picks vault (OnPrem for `Development`, Azure otherwise), overridable by `BLOCKS_VAULT_TYPE`. Secrets (DB connection, message connection, root DB name) come from the Genesis vault + the Mongo `Secrets` doc (`SecretKey` `blocks-secret-os`).
- **App settings:** `appsettings.json` + per-env overlays (`appsettings.Development.json`, `.dev.json`, `.stg.json`, `.prod.json`). Key values: `SwaggerOptions` (Title "Blocks OS", `ServiceName` currently `blocks-idp` — see #331 gap), `RootTenantId`, `KbtclIdentifier` (base domain suffix), and a `FrontendRuntime` section.
- **Frontend runtime injection:** at startup the API rewrites placeholder tokens (`__BLOCKS_*__`) in the built client assets from the `FrontendRuntime` config section (sourced from the Mongo `Secrets` doc, overridable by `FrontendRuntime__BLOCKS_*` env vars). This is how per-environment base URLs / client-ids / site keys reach the SPA without a rebuild.
- **Client env:** Vite `envPrefix: ['BLOCKS_']`; dev proxy routes `/api`, `/idp`, `/lmt`, `/uds`, etc. to `BLOCKS_OS_BASE_URL`, and IAM proxies to `BLOCKS_IAM_BASE_URL`. Optional dev HTTPS via `OS_SSL_CERT`/`OS_SSL_KEY`.
- **Environment tiers:** 8 fixed tiers (`client/app/constants/environment-options.ts`): Development (`dev`), Testing (`test`), Staging (`stg`), IAT (`iat`), UAT (`uat`), Prod Shadow (`prod-shadow`), Pre-Prod (`pre-prod`), Production (`prod`).
- **Deployment:** three CI/CD workflows — `ci-dev.yml`, `ci-stg.yml`, `ci_prod.yml` — build client + worker Docker images, push to ACR, and update GitOps for AKS via shared `blocks-inventory` workflows.

---

## 9. Testing & Quality

### Backend
- **Framework:** xUnit 2.9 + Moq 4.20 + FluentAssertions 8.8 (`server/XUnitTest`, ~268 `[Fact]`/`[Theory]` tests across Controllers, Services, Validators, Worker, Helpers).
- **Coverage:** collected with `coverlet.collector` (Cobertura) using `coverage.runsettings`, which **excludes infrastructure/boilerplate** (Program/Extensions, Repositories, Consumers, cert storage backends, and pure DTO/entity/request/response folders) to measure meaningful units only. Latest local run: **line-rate ≈ 0.57, branch-rate ≈ 0.49**.
- **Command (target, #341):** `dotnet test server/XUnitTest/XUnitTest.csproj`.

### Frontend
- **Framework:** Vitest 4 + Testing Library (`@testing-library/react`/`dom`/`user-event`), `jsdom`, `msw` for mocking; `@vitest/coverage-v8` present. Scripts: `test` (`vitest run`), `test:watch`.
- **Gaps vs decisions:**
  - **#337:** the test block is currently **inlined into `vite.config.ts`**; the decision is to standardize on a **separate `client/vitest.config.ts`** in every repo (globals:true, `plugins:[react()]`, a coverage block), and every repo must expose `test`, `test:watch`, and **`test:coverage`** scripts. blocks-os is **missing the `test:coverage` script** and has **no separate `vitest.config.ts`**.

### CI & coverage gate
- **Current state:** `RUN_TESTS: "true"` is set in the workflows, but the actual test-running jobs (`pr-checks` for backend and the frontend vitest job) are **commented out** — no test step executes in CI today. The flag is threaded to an output but not consumed by an active job.
- **Decided target (#341):** enable the existing gate via the `RUN_TESTS` flag (no separate CI path) and add a **PR-only** job running backend `dotnet test server/XUnitTest/XUnitTest.csproj` and frontend `npx vitest run` (from `client/`), across `ci-dev.yml`, `ci-stg.yml`, `ci_prod.yml`. Prereq #286 (CI runs the suites) lands first.
- **Coverage-gate decision (#323):** a **fixed, permanent 50% floor** for **both** backend and frontend (flat 50% each). **CI-only and blocking** — a push below 50% fails the CI check and blocks merge; local `npm run build`/`dev` is never gated. **No ramp, no ladder** (the earlier 60→70→85 idea is abandoned); any future change is a separate explicit decision. `test:coverage` must emit a machine-readable report.
- **e2e (#340):** a dedicated e2e environment with an **isolated database** (not shared dev) is approved, with a seeded test IdP account / service token stored as a rotated CI secret scoped only to e2e. Treated as infrastructure; per-app smoke suites are child issues under an e2e Epic. An `e2e/` folder exists in the repo.
- **Naming conventions (#338):** **document only** for now — add React (client) and .NET (server) naming-convention docs; **hold** on CI enforcement (`.editorconfig`/analyzers/ESLint) until standards are validated across all 5 repos.

---

## 10. Known Technical Debt & Decisions

Each item lists the decided resolution and ticket.

- **#279 — LogController wrong permission scope (confirmed bug):** logs gated by `blocks-os::mail::gets`. Fix to `blocks-os::log::gets` **plus** a coordinated per-tenant grant migration (both parts ship together). Open: separate `log::get-live` scope for the live endpoint or not.
- **#328 — MailController Get/Gets:** `Get` returns HTTP 500 (unguarded NRE ~`ConfigurationService:256`); `Gets` null-branch is dead. Fix: `Task<IActionResult>` return type + null-guard in the service + 404 for not-found + delete dead branch.
- **#327 — Explicit auth intent:** make `ConfirmInvitation` explicit (`[AllowAnonymous]` or scoped). Do **not** scope `SecretsController` here (deferred to Secrets Management Epic). `ApiEndpointConfigController` and `DomainController` stay `[Authorize]`-only (intentional).
- **#329 — "My Service" → "My Services":** rename the customer-owned app-registration surface to **My Services** (plural), move route to `/app/secret-management/my-services` with a redirect from `/managed-services`, fix copy/identifiers. **Gap:** current nav label is "My Service" and route is `managed-services`. The platform-capability taxonomy ("Managed Services", aligned to IAM/OS/Data/Utility/Release/Localization) is a **separate** issue.
- **#330 — Tenant-group naming:** rename the customer-facing `UpdateTenantGroup` endpoint/route/DTO/client constants off "tenant group" to **Project** (backend+frontend together, no external deprecation cycle). Internal `TenantGroup` identifiers may remain. Casing mismatch tracked separately.
- **#331 — Service identity:** `blocks-idp` is stale; align Swagger `ServiceName`, namespaces, and derived permission prefix to **blocks-os**. **Gap:** `SwaggerOptions.ServiceName` still `blocks-idp`.
- **#332 — API consistency:** only real defect actioned — type `TraceController.GetTraces`/`GetTrace` to concrete return types (analytics stay `Task<object>`). List-name/POST-verb/scope-noun inconsistencies **not** actioned.
- **#333 — Misspellings/casing (Epic):** the `Enviroment`/`SharedEnviroments`/`EnviromentDetails`/`IsExistingEnviroment` misspelling on the **public wire contract** is a coordinated cross-repo migration (blocks-data + blocks-iam too) with backward-compat sequencing. Notification typos, `DomainMangementService.cs` filename, camelCase DTO props, missing `Async` suffixes, `TransferOwnerShip` route, `CreateProjectRequest.cs` file-org, client naming, and `ControllerMap.txt /Permissioin` are split into separate smaller tickets.
- **#334 — Scope grammar:** canonical `service::area::action`, kebab-case action, prefix derived from `ServiceName`. blocks-os is the non-breaking derived-prefix case, sequenced behind #331.
- **#335 — Shared client libs:** migrate `client/app/lib/*.ts` into `blocks-kit` as a configurable shared base (Epic, per-file PRs, drift classification).
- **#336 — Response envelope:** single Genesis-owned envelope, extended additively with optional `ValidationErrors`.
- **#325 — Resource-limit transparency:** limits are data-driven per tenant (`ResourceLimits` collection), surfaced proactively (usage page + creation/invitation entry points). The invitation-blocking limit is a **people/seat quota** (`QUOTA_REDIRECT_CONFIG.PEOPLE → /people`). Split: Issue A (quota transparency) and **Issue B (re-enable the disabled `CopyAndCustomizeResourceLimitsAsync` seed at `ProjectRepository.cs:314`)**. Wire the usage-page LIMIT column to live per-tenant data now; keep usage numbers as sample until #305.
- **#339 — "LMT" → "Logs & Traces":** rename the console area (label change only — no metrics rendered today and none planned in OS). **Gap:** nav still uses "LMT"/"Metrics"/"Observability" grouping (`lmt-nav.ts`). Also fix `serviceAccessResourceName` `blocks-os` → `blocks-monitor` in blocks-monitor's `Program.cs` (unintentional entanglement).
- **#323 / #341 / #340 / #337 / #338 — Testing/CI:** see §9.

---

## 11. Non-Functional Requirements

### Security
- All authentication delegated to blocks-iam via OIDC/OAuth2; API validates bearer JWTs; no local credential store.
- Endpoints are permission-scoped via Genesis `[ProtectedEndPoint]`; a few remain `[Authorize]`-only by explicit decision (`ApiEndpointConfig`, `Domain`), with secrets deferred to a dedicated hardening epic.
- Secrets stored via Genesis vault (OnPrem/Azure) and Mongo `Secrets` doc; per-service telemetry uses **scoped** Service Bus connection strings issued at registration.
- Custom-domain provisioning mutates shared reverse-proxy hosts over SSH with automated Let's Encrypt certificates.
- Known security-relevant debt is tracked and decided: the log-scope bug (#279) and the explicit-auth-intent items (#327) are the priority fixes.
- **Coverage gate (#323)** is a merge-blocking quality control once #341/#286 land.

### Multi-tenancy
- Strict per-environment isolation: one MongoDB database per tenant/environment, selected by the `X-Blocks-Key` header and enforced through `BlocksContext`.
- Cross-tenant operations (permission-scope grant migrations, log-scope fix) must ship code + per-tenant seed/migration **together** to avoid tenants losing access on deploy (#279).
- Resource quotas are per-tenant data (`ResourceLimits`), enabling future subscription tiers without code change.

### Performance / scale
- Telemetry ingestion is asynchronous and batched (`LmtMongoPersistence.InsertManyAsync`), decoupling registered services from the query path.
- Provisioning and long-running work (project setup, domain binding, data migration) run in the Worker via the message bus, with resumable progress tracking (`ProjectStatusTracer`).
- Multipart upload cap 15 MB (`FormOptions`). Live logs stream over SignalR.
- Product limits: **10 projects** per customer and **8 environments** per project. **Open / undecided:** whether these caps are permanent product rules or plan-tied (they currently apply regardless of plan).

---

### Open Questions (not resolved by the decisions)
- **#279:** whether the live-logs endpoint gets its own `blocks-os::log::get-live` scope or shares `blocks-os::log::gets`.
- Whether the 10-project / 8-environment caps are permanent or subscription-tied (product rule undecided).
- Product-facing boundary questions from `product-questions-blocks-os.md` sections C/D that are not covered by an answered ticket (e.g. long-term LMT-vs-blocks-monitor ownership beyond the #339 label change; whether org/end-user management stays in the console long-term) remain product-owner decisions.

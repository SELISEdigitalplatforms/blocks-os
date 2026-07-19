# Blocks OS — Features Specification

> One-line note: derived from the Business/Product/Technical/Architecture specs + the code on `inception` + the authoritative product decisions (`DECISIONS-blocks-os.md`) + open GitHub issues. Status reflects the ACTUAL code as verified against the implementation on 2026-07-20.

## How to Read

Status legend: **✅ Shipped** (implemented, matches intended behaviour) · **🟡 Partial** (implemented but with a gap vs the decision/intent) · **🔴 Defect** (implemented but broken/incorrect) · **🗺️ Roadmap** (decided, not yet built) · **❓ Undecided** (no decision yet). Every status is grounded in code that was read for this document.

Product name: **Blocks OS** (decided; confirmed in `client/index.html` `<title>`, `server/Api/appsettings.json` `SwaggerOptions.Title`, `client/app/constants/blocks-products.ts`). Note the backend still self-identifies as `blocks-idp` on the wire (`ServiceName`, see cross-cutting §2 / #331).

---

## 1. Feature Inventory

### Area A — Projects & Provisioning

#### Project creation & tenant provisioning — ✅ Shipped
- **What it does:** 3-step wizard (Name → Add repositories → Configure environments) creates a tenant group and one tenant per selected Environment; async completion in the Worker generates signing certificates, inserts the creator as `ProjectPeople` owner (`IsCreator=true`), and copies default config (roles, permissions, mail, storage, localization, schema, identity) into each new tenant DB.
- **Current status:** Verified. `ProjectController.Create` → `ProjectManagementService.SaveProjectAsync` → publishes to `blocks_project_listener` → `Worker/Consumers/Identifier/ConfigureProjectConsumer` completes setup. Progress is tracked in a resumable `ProjectStatusTracer` (`IsCertificatesUploaded`, `IsProjectUpdated`, `IsDefaultConfigurationCopied`, `InsertedIntoProjectPeople`, `IsProjectCreationSuccess`) with `RestoreUnfinishedProjectAsync`.
- **Limitations:** `ResourceLimits` are NOT seeded on create — `CopyAndCustomizeResourceLimitsAsync` is commented out at `ProjectRepository.cs:314` (the method still exists at `:352`), so new tenants ship with no per-tenant quota data (#325 Issue B). Provisioning-progress UX and partial-failure notification to the customer are undefined (product Q B6). Automatic seeding is not opt-out-able (Q D5).
- **Suggested changes:** (P1) Re-enable `CopyAndCustomizeResourceLimitsAsync(sourceDatabase, consumerDb, project)` at `ProjectRepository.cs:314` and verify seeded limits land in each tenant (#325 Issue B). (P2) Surface provisioning status/failure in the console (resumable tracer already exists; only UI is missing).

#### Console / Project list — ✅ Shipped
- **What it does:** Lists a user's Projects as cards with Environment chips; drill-in opens an Environment. `ProjectController.Gets` returns `List<GroupedProjectsDto>` grouped by tenant group.
- **Current status:** Verified in `client/app/pages/console` and `ProjectController`.
- **Limitations:** UI shows hard caps of 10 Projects / 8 Environments; these are applied regardless of plan and their permanence is undecided (Q B7). Caps are UI-side, not read from the (currently unseeded) `ResourceLimits`.
- **Suggested changes:** (P3) Once resource-limit seeding is re-enabled, drive the Project cap from `ResourceLimits` rather than a UI constant so it can become plan-tied (#325).

#### Project rename — 🟡 Partial
- **What it does:** Rename a Project. Two endpoints exist: `ProjectController.UpdateProject` and `ProjectController.UpdateTenantGroup` (both `blocks-os::project::mutate-project`).
- **Current status:** Implemented, but the customer-facing endpoint/route/DTO still carries the retired "tenant group" term (`UpdateTenantGroup`, `UpdateTenantGroupRequest`).
- **Limitations:** "Tenant group" is decided internal-only but is on the public wire contract (#330). A `tenantGroupId`/`TenantGroupId` query-param casing mismatch exists in `project.service.ts` (tracked separately under #330).
- **Suggested changes:** (P2) Rename `UpdateTenantGroup` endpoint/route/DTO/client constants to a Project term, backend+frontend in one change (API is consumed only in-repo, so no external deprecation cycle) (#330).

#### Disable / Restore project — ✅ Shipped
- **What it does:** Soft-disable a project (`ProjectController.Disable`, scope `delete-project`) and restore it (`Restore`, scope `restore-project`), with async data cleanup via `blocks_data_cleanup_listener` and `RestoreProjectConsumer`.
- **Current status:** Verified. `Disable` reads the active tenant from `BlocksContext`.
- **Limitations:** No hard-delete path (intentional — hard delete is out of scope). Restore depends on cleanup not having purged data irrecoverably; safeguards are not documented.
- **Suggested changes:** (P3) Document the disable→cleanup→restore data-retention window so customers know how long a disabled project is restorable.

### Area B — Environments

#### Environment management (view / add) — ✅ Shipped
- **What it does:** View a Project's Environments and add new ones from 8 fixed tiers; the "New Environment" action is Owner-gated and hidden once 8 exist.
- **Current status:** Verified. `client/app/constants/environment-options.ts` defines exactly 8 tiers: Development (`dev`), Testing (`test`), Staging (`stg`), IAT (`iat`), UAT (`uat`), Prod Shadow (`prod-shadow`), Pre-Prod (`pre-prod`), Production (`prod`).
- **Limitations:** Tiers are a hardcoded fixed list; customers cannot name their own Environments (Q B3). Adding a tier assumes a matching repo branch already exists — a convention the UI warns about but does not enforce or verify.
- **Suggested changes:** (P3) Decide fixed-vs-custom tiers (Q B3); if kept fixed, make the branch-must-exist rule explicit in copy rather than implied.

#### X-Blocks-Key surfacing — ✅ Shipped
- **What it does:** Presents each Environment's tenant key (`X-Blocks-Key`) plus CLI/Git snippets in the Environment Overview so a developer can wire their app.
- **Current status:** Verified. The key is the tenant credential resolved by Genesis `BlocksContext`; the client sends it per request (`http-client.ts`, `oidc-auth-flow.service.ts`).
- **Limitations:** No key rotation / regeneration surface in the console; a leaked `X-Blocks-Key` cannot be self-service rotated.
- **Suggested changes:** (P2) Add a key-rotation action for an Environment so a compromised tenant key can be replaced without recreating the Environment.

#### Environment data migration — ✅ Shipped
- **What it does:** Copy data source→target Environment, per service, with a per-service overwrite toggle; runs async and the UI refreshes on a completion notification.
- **Current status:** Verified. `MigrationTrackers` collection; queues `blocks_generic_migration_listener` / `blocks_uilm_environment_data_migration_listener` / `blocks_data_cleanup_listener`; completion signalled on `migration_topic`. Client in `components/environment-migration/`.
- **Limitations:** The "overwrite" toggle is destructive with no documented safeguard/confirmation-depth or backup (Q C6). Business intent (seed new env vs refresh staging from prod) is undecided.
- **Suggested changes:** (P2) Wrap the overwrite path in an explicit confirmation and, ideally, a pre-migration snapshot or dry-run summary of what will be overwritten (Q C6).

#### Entering an Environment ("impersonation") — 🟡 Partial
- **What it does:** Opening an Environment "impersonates" that tenant client-side (`store/impersonate-store.ts`) so subsequent calls carry that Environment's `X-Blocks-Key`.
- **Current status:** Implemented and functional.
- **Limitations:** "Impersonation" is a developer-facing internal mental model that leaks to customers; whether it is the right customer word (vs "opening") is undecided (Q B4). No audit trail surfaced for which Environment an operator entered.
- **Suggested changes:** (P3) Resolve the wording (Q B4); rename the customer-facing concept to "open Environment" if confirmed.

### Area C — People & Access

#### Invite People — 🟡 Partial
- **What it does:** Owner invites email(s) to chosen Environments; creates per-Environment `ProjectPeople` grants, publishes a create-user event to IAM for new users, and queues an invitation email with an `/invitation?code=…` link.
- **Current status:** Verified. `PeopleController.Invite` (scope `blocks-os::people::invite`) → `PeopleService.InvitePeoplesAsync`.
- **Limitations:** (1) **Invitation link expiry does not match the decision.** `PeopleService` resolves lifetime from config `InvitationLifetimeInMinutes` or falls back to `DefaultInvitationLifetimeInMinutes = 60*24` (24h), then clamps to the IAM key lifetime — NOT the decided fixed 1 hour (#324). (2) **Roles are dropped on the new-user (IAM) path** — set on the sync invite path but not carried when IAM creates the account (#350). (3) **Invites can silently fail** — IAM rejection is unreported and handler exceptions are dropped with no DLQ (#351). (4) Invitees default to role `["user"]`; explicit invite-time role selection is undecided (Q B2).
- **Suggested changes:** (P1) Fix the new-user path to persist `ProjectPeople.Roles` (#350). (P1) Report IAM rejection to the caller and add a dead-letter path for dropped invite handler exceptions (#351). (P2) Make the invite link a hardcoded 1-hour expiry per #324, removing the config knob and 24h fallback.

#### Confirm invitation / activation — 🔴 Defect
- **What it does:** Public confirm-invitation endpoint that redeems the code and activates access.
- **Current status:** Verified defect. `PeopleController.ConfirmInvitation` (line 56) has **no authorization attribute at all** — neither `[AllowAnonymous]` nor a scope.
- **Limitations:** This is a live security hole, escalated in #352: a leaked/forwarded invite link enables account takeover because the endpoint is effectively anonymous with no explicit intent. Related activation-page bugs: already-activated accounts show "Invalid Activation Link" and expired codes are mislabelled (#349); activation URL lifetime cannot exceed 7 days due to the IAM key clamp (#348).
- **Suggested changes:** (P1) Make the auth intent explicit — `[AllowAnonymous]` only with a single-use, short-lived, unguessable code and confirmation that redemption is bound to the intended email; otherwise a scoped attribute (#327, #352). (P2) Fix activation-page states for already-activated / expired codes (#349).

#### Resend invitation — ✅ Shipped
- **What it does:** Owner re-sends an invitation/activation link (`PeopleController.ResendInvitation`, scope `blocks-os::people::resend`).
- **Current status:** Verified.
- **Limitations:** Inherits the invite lifetime/rejection gaps above (#324, #351). Post-expiry self-service (invitee re-requests without Owner) is undecided (Q B5).
- **Suggested changes:** (P3) Decide post-expiry self-service (Q B5) once the 1-hour expiry lands.

#### Remove access — ✅ Shipped
- **What it does:** Owner removes a Person's access per Environment (`PeopleController.RemoveAccess`, scope `blocks-os::people::remove-access`).
- **Current status:** Verified; Owner-gated.
- **Limitations:** No bulk remove-across-all-environments action; removal is per-Environment.
- **Suggested changes:** (P3) Add a "remove from all Environments" convenience action.

#### Transfer ownership — ✅ Shipped
- **What it does:** Owner transfers the Project to one other existing user across all Environments (`PeopleController.TransferOwnerShip`, scope `blocks-os::people::transfer-owner`).
- **Current status:** Verified.
- **Limitations:** Route naming `TransferOwnerShip` is a known naming issue (#333, split to a separate People-API ticket). Single-owner model means a Project is stranded if the sole Owner leaves without transferring.
- **Suggested changes:** (P2) Decide multi-owner support (Q B1) so a Project is not stranded on Owner departure.

#### Owner model — ✅ Shipped
- **What it does:** Project Owner = the creator, stored as boolean `ProjectPeople.IsCreator` (not a role); gates invite / remove / transfer.
- **Current status:** Verified.
- **Limitations:** Single-owner only; no co-admin concept (Q B1).
- **Suggested changes:** (P2) See Transfer ownership — introduce multiple owners/admins (Q B1).

#### Seat / resource-limit enforcement — 🔴 Defect
- **What it does:** Intended to block invitations when a tenant's People/seat quota is exceeded, surfaced proactively at the usage page and invitation entry point (#325).
- **Current status:** **Not enforced server-side.** `PeopleService` (invite path) contains no `ResourceLimit`/quota check. `SubscriptionRepository.GetSubscriptionsAsync` only READS the `ResourceLimits` collection for the usage view. The only quota gating is a client-side redirect config (`client/app/cross-modules/lmt/utils/quota-redirect-config.ts`, `QUOTA_REDIRECT_CONFIG.PEOPLE → /people`). Because seeding is also disabled (`ProjectRepository.cs:314`), the collection is empty for new tenants, so even the client redirect has no data.
- **Limitations:** A determined caller can invite past the seat limit by hitting the API directly; the "proactive, not silent" transparency promise (#325) is unmet server-side.
- **Suggested changes:** (P1) Add a server-side seat-quota check in `PeopleService.InvitePeoplesAsync` reading `ResourceLimits`, returning a structured limit error; ship together with the seeding re-enable (#325 Issue A + B).

### Area D — Repositories

#### GitHub connect & repository linking — ✅ Shipped
- **What it does:** Connect a GitHub account via OAuth, list repositories, and link them to a Project (stored as `TenantAsset` with `TenantGroupId` + `List<Resource>`).
- **Current status:** Verified. `client/app/pages/repositories`, `cross-modules/devops`, GitHub callback route, `ProjectController.AddAsset`/`GetAsset`, `BLOCKS_GITHUB_SSO_CLIENT_ID`.
- **Limitations:** GitHub is the only supported provider; no GitLab/Bitbucket/Azure DevOps. Repo linkage is metadata only (no webhook/CI wiring from the console).
- **Suggested changes:** (P3) If multi-provider is a goal, abstract the devops connector; otherwise document GitHub-only explicitly.

### Area E — My Services (telemetry registration)

#### Service registration — 🟡 Partial
- **What it does:** Register a backend service (`Api`/`Worker`); provisions a Service Bus topic with `logs`/`traces` subscriptions (or RabbitMQ channels) and returns a Service ID + scoped connection string for streaming telemetry.
- **Current status:** Verified. `ServiceController.Register` (scope `blocks-os::service::register`) / `GetAll`. `BlocksManagedService` entity carries `ServiceBusConnectionString` (scoped credential). Ingestion by `LmtManagedServiceWorker` via Redis `service::activity`.
- **Limitations:** Customer-facing naming is wrong per #329 — nav label is **"My Service"** (singular) and the route is `/app/secret-management/managed-services`, not the decided **"My Services"** at `/app/secret-management/my-services` with a redirect (confirmed in `navigation-menus.ts:101-104` and `secret-management-nav.ts:45-47`). Observability is opt-in per service (nothing captured until registered).
- **Suggested changes:** (P2) Rename to "My Services" (plural), move the route to `/my-services` with a redirect from `/managed-services`, and fix identifiers/guide copy (#329). Keep the platform-capability "Managed Services" taxonomy as a separate surface.

### Area F — Logs & Traces

#### Logs & Traces — Usage — ✅ Shipped
- **What it does:** Aggregate API-call analytics (total calls, avg response time, success/error counts).
- **Current status:** Verified via `TraceController.GetOperationalAnalytics`/`GetServiceAnalytics` (scope `blocks-os::trace::get-analytics`).
- **Limitations:** Analytics endpoints return `Task<object>` (genuinely dynamic — decided to stay untyped, #332), so Swagger documents no schema for them.
- **Suggested changes:** (P3) None required by decision; optionally document the dynamic payload shape in the README.

#### Logs & Traces — Tracing — 🔴 Defect (Swagger typing)
- **What it does:** Distributed request traces and per-trace timelines.
- **Current status:** Verified. `TraceController.GetTraces` (POST) and `GetTrace` (GET) both return `Task<object>` (lines 25, 32), so Swagger produces no schema for them.
- **Limitations:** Untyped returns break codegen/schema for these two concrete endpoints (#332). Functionality works; the defect is contract documentation.
- **Suggested changes:** (P2) Type `GetTraces`/`GetTrace` to their concrete return types so Swagger documents a schema; leave the two analytics endpoints as `Task<object>` (#332).

#### Logs & Traces — Logs — 🔴 Defect (wrong permission scope)
- **What it does:** Searchable per-service logs, live tail (SignalR), and an AI assistant to query logs.
- **Current status:** Verified. All three `LogController` endpoints (`GetLogs`, `GetLogsByDate`, `Live`) are gated by **`blocks-os::mail::gets`** (lines 24/32/40) instead of a log scope (#279).
- **Limitations:** Log access is coupled to a mail permission — anyone with mail-read can read logs, and role holders intended for logs may lack it. Multi-tenant: the fix must ship code + per-tenant grant migration together or every tenant loses log access on deploy. Live-log split (`blocks-os::log::get-live`) is undecided.
- **Suggested changes:** (P1) Change the three attributes to `blocks-os::log::gets` AND ship a per-tenant seed/migration that registers the new scope and grants it to roles currently holding `blocks-os::mail::gets` (#279). Decide the live-log scope split.

### Area G — Secrets & Configs

#### Secrets vault — 🟡 Partial
- **What it does:** Per-tenant key/value secret CRUD (`SecretsController` Save/Gets/Get/Delete).
- **Current status:** Verified. Backed by `Secrets.DomainService` (`SecretManagementService`/`SecretRepository`). Secrets are stored in a **MongoDB collection** (`SecretRepository` uses `_dbContextProvider.GetCollection<Secret>`), NOT a key vault.
- **Limitations:** (1) `SecretsController` is `[Authorize]`-only (no fine-grained scope) — intentionally deferred to a Secrets Management Epic (#327). (2) Secrets live in Mongo, but #322 decides they should live in a key vault. (3) The Secrets UI is currently disabled in the router.
- **Suggested changes:** (P1) Move secret storage to a key vault backend (#322). (P2) Under the Secrets Management Epic, define the scoped authz model, re-enable the UI, and add default grants + tests (#327).

#### Storage configuration — ✅ Shipped
- **What it does:** Per-tenant S3-compatible object-storage provider config (`StorageController` Save/Gets/Get/Delete).
- **Current status:** Verified via `CloudConfiguration.DomainService`.
- **Limitations:** `Delete` is a POST with a `mutate` scope (decided acceptable — save-access implies delete, #332), which reads oddly in the API surface.
- **Suggested changes:** (P3) None per decision (#332); documentation only.

#### Mail configuration — 🔴 Defect
- **What it does:** Per-tenant SES/SMTP mail-server config (`MailController` Save/Get/Gets/Delete/Duplicate).
- **Current status:** Verified defect. `Get` returns `Task<MailConfiguration>` (line 36) and the `BadRequest(response)` at line 51 is a **discarded** return value; the underlying `ConfigurationService.GetMailConfigurationAsync` dereferences without a null-guard, so a missing config throws → HTTP 500 (not "200 + null body" as #328's title states). `Gets` has an unreachable null branch (`ToListAsync` never returns null).
- **Limitations:** Reading a not-yet-configured mail server returns 500 instead of 404 (#328).
- **Suggested changes:** (P1) Change `Get`/`Gets` return type to `Task<IActionResult>`, add the null-guard in `ConfigurationService` (return-type change alone does not fix the 500), return 404 for not-found, and delete the dead null branch in `Gets` (#328).

#### Notification configuration — ✅ Shipped
- **What it does:** Per-tenant notifier config (`NotificationController` Save/Gets/Get/Delete).
- **Current status:** Verified.
- **Limitations:** Request-type identifiers are misspelled (`SaveNotificatonConfigurationRequest`, `DeleteNotificatoinConfigurationRequest`, `GetNotificatoinConfigurationAsync`); `NotificationResponse` is dead code (#333, split to a separate cleanup ticket).
- **Suggested changes:** (P3) Fix the typo'd request identifiers and remove dead `NotificationResponse` (#333).

#### Custom domain & certificates — ✅ Shipped
- **What it does:** Verify/bind a custom domain (CNAME); provisions nginx reverse-proxy vhosts + Let's Encrypt/certbot on remote hosts over SSH (`DomainController.Configure` → `DomainConfigureConsumer` → `DomainMangementService`, `SSH.NET`).
- **Current status:** Verified; `[Authorize]`-only (intentional, #327).
- **Limitations:** Mutates shared SSH-reachable proxy hosts (blast radius); operational ownership/turnaround/SLA when validation fails is unspecified (Q C5). Filename `DomainMangementService.cs` is misspelled (#333, minor). `[Authorize]`-only is coarse but decided.
- **Suggested changes:** (P2) Define and document the custom-domain SLA and failure-ownership (Q C5). (P3) Rename the misspelled service file (#333).

#### API endpoint security ("API Settings") — ✅ Shipped
- **What it does:** Per-endpoint allow/deny, required roles, MFA/captcha requirement, and rate limit, grouped by service/controller (`ApiEndpointConfigController` GetList/Update/BulkUpdate).
- **Current status:** Verified; `[Authorize]`-only (intentional for now, #327).
- **Limitations:** Coarse authz (any authenticated user, not scoped) — decided acceptable for now but a known gap for a security-configuration surface.
- **Suggested changes:** (P3) Revisit scoped authz under the later permission-standardization issue (#327 defers it).

### Area H — Identity & Auth Admin (delegated)

#### Roles / Permissions / Users / Organizations / OIDC / SSO / Identity Providers / Client Credentials / Signup — ✅ Shipped (as embedded UI)
- **What it does:** Console screens for identity/access administration.
- **Current status:** Verified as UI-over-blocks-iam — these call `API_BASES.IAM` directly; the in-repo `Iam.DomainService`/`Iam.Driver` projects contain zero `.cs` files (stubs).
- **Limitations:** Not implemented in this repo; correctness/availability depends entirely on blocks-iam. Identity UX is split across OS/IAM/Logic, which the console must present as one place (Q D1/D3).
- **Suggested changes:** (P3) None in-repo; ensure the embedded screens degrade gracefully when IAM is unreachable.

#### MFA & captcha configuration — ✅ Shipped (as embedded UI)
- **What it does:** MFA and captcha settings screens.
- **Current status:** Verified as UI-over-"Blocks Logic" — calls `API_BASES.LOGIC`, not IAM or this repo.
- **Limitations:** Split from the rest of identity (served by Logic), which may feel disjointed to customers (Q D3).
- **Suggested changes:** (P3) Resolve whether MFA/captcha should feel unified with IAM identity (Q D3).

### Area I — Subscription & Usage

#### Subscription & usage view — 🟡 Partial
- **What it does:** Plan/usage overview across services with per-Environment breakdown.
- **Current status:** Verified partial. `SubscriptionRepository.GetSubscriptionsAsync` reads live per-tenant `ResourceLimits`, but the page is explicitly mock — `subscription-usage-page.tsx:421` says "Using mock data for now". LIMIT column is intended to read live per-tenant data; consumption numbers stay sample until #305.
- **Limitations:** Usage numbers are sample/mock; with seeding disabled (`ProjectRepository.cs:314`) the `ResourceLimits` set is empty for new tenants, so even the LIMIT column has no live data to show. Real billing/plans undecided (Q C2). Plan labels ("Free"/"Enterprise") appear inconsistently.
- **Suggested changes:** (P2) Wire the LIMIT column to live per-tenant `ResourceLimits` (depends on re-enabling seeding) and keep usage as sample until #305 (#325). (P3) Decide billing/plan model (Q C2).

#### Resource-limit model — 🟡 Partial
- **What it does:** Data-driven per-tenant quota (`ResourceLimit`: `Resource`, `ResourceType`, `Limit`, `Usage`, `Lifetime`, `IsActive`, `EnableAutoRenew`, `TenantId`, `Type`); `UpdateResourceUsageConsumer` maintains `Usage`.
- **Current status:** Model + usage consumer exist and are verified; seeding and enforcement are the gaps (see Seat enforcement and Project creation).
- **Limitations:** Not seeded on create (#325 Issue B); not enforced server-side for invitations; no customer-facing documentation of the enforced limit set exists (#325).
- **Suggested changes:** (P1) Re-enable seeding + add server-side enforcement (#325). (P3) Publish customer-facing docs of the Project/Environment/People-seat/IAM quota set with `ResourceLimits` as source of truth (#325 Issue A).

### Area J — Platform & Cross-Suite

#### Cross-links to Blocks suite — ✅ Shipped
- **What it does:** Login carousel + navigation to Construct, Cloud Build/Release, Agents/AI, Data, Localization, Logic, Studio, Utilities via federated OAuth.
- **Current status:** Verified. `blocks-products.ts`, `endpoint.constant.ts` `API_BASES`, runtime-injected base URLs/client-ids.
- **Limitations:** Hub-vs-peer positioning undecided (Q D6). Some linked capabilities are present-but-disabled (see below).
- **Suggested changes:** (P3) Resolve hub-vs-peer positioning (Q D6).

#### Present-but-disabled capabilities (My Secret, Magic URL, AI Models, Localization manager) — ❓ Undecided
- **What it does:** Personal secrets, passwordless magic links, AI-model integrations, and a localization/UILM manager — present in code but switched off.
- **Current status:** Verified disabled. `navigation-menus.ts` has them commented out (`// My Secret`, `// Magic URL`, `// AI Models`, and hidden icon imports at lines 6/17/19). Localization module exists in `cross-modules/localization` but is not routed into the shell.
- **Limitations:** Dead/hidden UI carried in the bundle; fate (launch / deprioritize / cut) is undecided (Q C4).
- **Suggested changes:** (P3) Decide per-capability whether to build, defer, or delete; remove dead nav entries for anything cut (Q C4).

#### Frontend runtime config injection — ✅ Shipped
- **What it does:** One immutable client build serves all tiers; `ApplyFrontendRuntimeSettings` token-replaces `__BLOCKS_*__` placeholders in served `wwwroot` assets at startup from the Mongo `Secrets` doc / env vars.
- **Current status:** Verified in `Program.cs`.
- **Limitations:** Startup rewrite pass over `wwwroot`; requires placeholder discipline in the client. If a placeholder is missed it ships literally to the browser.
- **Suggested changes:** (P3) Add a startup assertion that no `__BLOCKS_*__` placeholder remains unreplaced after injection.

#### `/api/version` endpoint — 🗺️ Roadmap
- **What it does:** Return the running assembly version (for deploy verification).
- **Current status:** Not implemented — no version controller/endpoint exists (grep of `server/Api/Controllers` returns nothing). Requested in #342/#343 with README docs in #346.
- **Limitations:** No programmatic way to confirm which build is deployed.
- **Suggested changes:** (P2) Add `GET /api/version` returning the assembly version and document it in the server README (#343/#346).

#### CI test + coverage gate — 🗺️ Roadmap
- **What it does:** PR-only CI job running backend `dotnet test server/XUnitTest/XUnitTest.csproj` + frontend `npx vitest run`, with a permanent flat 50% coverage floor (backend and frontend independently), CI-blocking only.
- **Current status:** Not active. `RUN_TESTS: "true"` exists in the workflows but the test-running jobs are commented out in `ci-dev.yml`/`ci-stg.yml`/`ci_prod.yml`; no test step runs in CI. Backend suite exists (~268 tests, local line-rate ≈0.57). Frontend test block is inlined in `vite.config.ts`; there is no separate `vitest.config.ts` and no `test:coverage` script (#337).
- **Limitations:** Nothing gates merges today; coverage floor unenforced (#323, #341). Prereq #286 (CI runs the suites) not done.
- **Suggested changes:** (P2) Enable the `RUN_TESTS` gate with a PR-only job (#341); add a blocking 50% floor for both stacks (#323). (P3) Split out a separate `client/vitest.config.ts` and add `test:coverage` (#337).

#### Dedicated e2e environment — 🗺️ Roadmap
- **What it does:** Isolated e2e env + DB with a seeded IdP account/service token as a rotated CI secret; per-app smoke suites.
- **Current status:** Partial scaffolding only. An `e2e/` folder exists (Playwright config, `global-setup.ts`, `tests/`) but the dedicated environment + seeded credential is not provisioned (#340).
- **Limitations:** e2e is blocked until the isolated env + CI login secret exist (#340).
- **Suggested changes:** (P3) Provision the isolated e2e env + DB and a scoped, rotated CI login secret (infrastructure work, #340).

---

## 2. Cross-Cutting Limitations

- **Stale service identity (#331):** the backend self-identifies as `blocks-idp` (`appsettings.json` `ServiceName: "blocks-idp"`, verified line 16) even though `Program.cs` sets `serviceName = "blocks-os"`. Blocks the permission-prefix derivation (#334) which is sequenced behind it. Client `@blocks-idp/*` aliases and the `blocks-idp::read-users` test scope are separate cleanups.
- **Authorization consistency & security gaps:** `ConfirmInvitation` has no auth attribute (🔴 account-takeover risk, #327/#352); `LogController` uses a mail scope (🔴 #279); `SecretsController`/`ApiEndpointConfigController`/`DomainController` are `[Authorize]`-only by decision (#327). Any scope change on a multi-tenant catalog needs a coordinated per-tenant grant migration shipped with the code (#279).
- **Return-type / envelope inconsistency:** `TraceController.GetTraces`/`GetTrace` return `Task<object>` (no Swagger schema, #332); `MailController.Get`/`Gets` return raw model types with discarded `BadRequest` (500 on missing config, #328). The canonical response envelope should be the shared Genesis `BaseResponse` extended additively with an optional `ValidationErrors` field (#336) — no per-repo envelopes.
- **Resource limits are inert:** seeding is disabled (`ProjectRepository.cs:314`, #325 Issue B) and there is no server-side invitation enforcement, so the whole quota story (blocking, transparency, usage page) is currently non-functional for new tenants (#325).
- **Reliability of async flows:** invite handler exceptions are dropped with no DLQ and IAM rejections are unreported (#351); provisioning is resumable but has no customer-facing failure surface (Q B6).
- **Secrets at rest:** stored in MongoDB, not a key vault (#322).
- **Naming drift on the public wire:** `UpdateTenantGroup` (#330), `My Service`/`managed-services` route (#329), `Enviroment` misspelling on the wire contract (#333), and the "LMT" label with a "Metrics"/"Observability" nav grouping (`lmt-nav.ts`) despite no metrics being rendered (#339).
- **No CI quality gate:** tests exist but do not run in CI; no coverage floor enforced; no `/api/version` for deploy verification (#341, #323, #337, #342/#343).
- **Multi-tenancy caveat:** strict per-tenant DB isolation is solid, but permission/scope changes and log-scope fixes are only safe when the code and per-tenant catalog migration deploy together (#279, #334).
- **Product-rule uncertainty:** 10-Project / 8-Environment caps are UI constants applied regardless of plan; permanence undecided (Q B7). Single-owner model (Q B1), fixed tiers (Q B3), billing (Q C2), and disabled-feature fate (Q C4) are all open.

---

## 3. Suggested Changes — Prioritised

| Priority | Area/Feature | Suggested change | Why it matters | Rough effort | Ref (#ticket) |
|---|---|---|---|---|---|
| P1 | People / Confirm invitation | Give `ConfirmInvitation` explicit auth intent; if public, bind redemption to the intended email with a single-use short-lived code | Currently anonymous → account takeover via leaked link | S (attr) + M (hardening) | #327, #352 |
| P1 | Logs & Traces / Logs | Change 3 `LogController` scopes to `blocks-os::log::gets` + ship per-tenant grant migration together | Log access wrongly coupled to mail permission; multi-tenant deploy-safe | M | #279 |
| P1 | Config / Mail | Type `Get`/`Gets` to `Task<IActionResult>`, add null-guard in `ConfigurationService`, return 404, delete dead branch | Missing mail config returns HTTP 500 instead of 404 | S | #328 |
| P1 | Provisioning + Seat enforcement | Re-enable `CopyAndCustomizeResourceLimitsAsync` (`ProjectRepository.cs:314`) and add server-side seat-quota check in the invite path | Quotas are inert; invites bypass limits server-side | M | #325 |
| P1 | People / Invite | Persist `ProjectPeople.Roles` on the IAM (new-user) path; report IAM rejection + add DLQ for dropped handler exceptions | Roles silently lost; invites silently fail | M | #350, #351 |
| P1 | Secrets vault | Move secret storage from Mongo to a key vault backend | Secrets at rest belong in a vault | M–L | #322 |
| P2 | Naming / Service identity | Align `ServiceName`/namespaces to `blocks-os`, then derive the permission prefix | Stale `blocks-idp` identity blocks scope-grammar work | M | #331, #334 |
| P2 | My Services | Rename to "My Services" (plural), move to `/my-services` with redirect from `/managed-services` | Reserved term inverted in a customer-visible URL | S–M | #329 |
| P2 | Logs & Traces / Tracing | Type `GetTraces`/`GetTrace` to concrete return types (leave analytics as `object`) | Swagger documents no schema for these endpoints | S | #332 |
| P2 | Project rename | Rename `UpdateTenantGroup` endpoint/route/DTO/client off "tenant group" | Internal-only term on the public wire | M | #330 |
| P2 | Subscription usage | Wire LIMIT column to live per-tenant `ResourceLimits` (after seeding re-enabled); keep usage sample until #305 | Transparency promise unmet; page is mock | M | #325 |
| P2 | Platform / version | Add `GET /api/version` returning assembly version + README docs | No way to verify deployed build | S | #343, #346 |
| P2 | People / Invite expiry | Hardcode invite link to 1 hour; remove config knob + 24h fallback | Code default (24h, clamped) diverges from decision | S | #324 |
| P2 | Environments / X-Blocks-Key | Add Environment key rotation | Leaked tenant key cannot be rotated today | M | — |
| P2 | CI | Enable `RUN_TESTS` PR job + 50% coverage floor (both stacks) | No test/coverage gate on merges | M | #341, #323 |
| P3 | Naming / Logs & Traces | Rename "LMT"/"Metrics"/"Observability" nav to "Logs & Traces" | Advertises monitoring not delivered | S | #339 |
| P3 | People / Owner model | Decide + build multi-owner/admin support | Project stranded if sole Owner leaves | L | Q B1 |
| P3 | Environments / migration | Add overwrite confirmation + pre-migration summary/snapshot | Destructive overwrite has no safeguard | M | Q C6 |
| P3 | Config / Notification | Fix typo'd request identifiers; remove dead `NotificationResponse` | Naming hygiene | S | #333 |
| P3 | CI / test config | Add separate `client/vitest.config.ts` + `test:coverage` script | Standardize test wiring across repos | S | #337 |
| P3 | Disabled features | Decide fate of My Secret / Magic URL / AI Models / Localization manager; delete dead nav for anything cut | Dead UI carried in bundle | S–M | Q C4 |
| P3 | Custom domain | Define + document custom-domain SLA and failure ownership | No promised turnaround/ownership | S (docs) | Q C5 |

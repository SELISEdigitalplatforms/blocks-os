# Blocks OS — Product Specification

> Status: v1 specification. Grounded in the blocks-os codebase (server/ .NET + client/ React+Vite) and reconciled against the authoritative product decisions captured from answered tickets and product-owner review. Where the current code differs from a decision, the decision is the TARGET state and the gap is called out inline as **Gap:**.

---

## 1. Product Summary

**Blocks OS** is the central console and control plane of the SELISE Blocks platform. It is the single screen a developer or team uses to create a Project, split it into named Environments, invite People, register their own backend services for telemetry, configure platform plumbing (identity/auth, secrets, storage, email, notifications, custom domains, API-endpoint security), and observe their applications through Logs & Traces. It solves the day-0 / day-2 operations problem: create, populate, secure, and monitor an application environment from one place instead of wiring each backing service by hand.

The product is named **"Blocks OS"** in the UI (`client/index.html` title) and in the API's Swagger surface (`server/Api/appsettings.json` → `SwaggerOptions.Title = "Blocks OS"`). It positions itself as a modern platform for building and deploying secure, scalable applications with built-in observability and identity management (`client/app/constants/blocks-products.ts`).

Blocks OS is a **hub and provisioning layer**, not a replacement for the sibling services. It provisions the tenants that blocks-iam, blocks-data, blocks-localization, and blocks-monitor operate in, and it hosts (or embeds) admin UI for them. Multi-tenancy is expressed through a per-Environment tenant key (`X-Blocks-Key`), and all services authenticate through blocks-iam via OIDC.

**What Blocks OS actually implements in this repo:**
- Project creation and per-Environment tenant provisioning (certificates, DB, domains, default admin/owner, seeded default roles/permissions/mail/storage/localization/schema), completed asynchronously in a Worker.
- People management: invite by email to specific Environments, resend, remove access per Environment, transfer ownership.
- Environment management: add Environments (from 8 fixed tiers) and run Environment-to-Environment data migration.
- Managed-service registration ("My Services") to stream logs/traces into the console over Service Bus/RabbitMQ.
- A logs + traces ingestion and query pipeline (`LmtManagedServiceWorker`, `Cloud.LmtService`), surfaced under the **Logs & Traces** area.
- Per-tenant configuration controllers for mail, storage, notifications, secrets, custom domains, and API-endpoint security.
- Cross-links and federated OAuth into the wider Blocks product suite.

**What Blocks OS does NOT implement (delegated to blocks-iam and others):** roles, permissions, users, organizations, OIDC/SSO, identity providers, client credentials, and signup are UI surfaces that call blocks-iam directly (`API_BASES.IAM`). The `Iam.DomainService` / `Iam.Driver` server projects in this repo are stubs. MFA and captcha config screens call a separate "Blocks Logic" service (`API_BASES.LOGIC`).

---

## 2. Personas & Jobs-to-be-Done

### App Developer (primary persona)
Builds an application on Blocks. Jobs:
- Create a Project and choose its Environments; connect one or more GitHub repositories.
- Open an Environment to read its `X-Blocks-Key`, custom-domain/CNAME status, repo list, and CLI/Git snippets to wire the app.
- Register a backend service ("My Services") to obtain a Service ID + connection string so the service streams logs/traces into the console.
- Configure the Environment's plumbing: secrets, storage, email, notifications, OIDC/SSO, MFA, captcha, API-endpoint security.
- Debug using **Logs & Traces**: Usage (API-call metrics), Tracing (request traces), Logs (searchable logs, live tail, AI assistant).

### Project Owner / Tenant Administrator
In practice usually the same person as the developer — specifically the Project **Owner** (the creator; `ProjectPeople.IsCreator`). Jobs:
- Invite People by email to specific Environments with roles; resend invitations; remove access per Environment; transfer Project ownership. These actions are Owner-gated.
- Rename the Project, add/remove Environments (up to 8), and initiate Environment-to-Environment data migration.
- Configure access control (Roles, Permissions), Organizations, signup policy, and auth/token settings via the embedded blocks-iam screens.
- Review Subscription Usage and resource limits.

### Platform / Root Operator
Whoever runs the Blocks platform itself. Present in code as `RootTenantId` and a `BlocksConfiguration` source database that seeds new tenants, but with **no dedicated console screens** — an infrastructure-level role, not a console persona.

### Invited Collaborator (adjacent, mostly outside the console)
A teammate who receives an invitation email and opens the public confirmation page (`/invitation`, `/activate`) to activate access. Beyond activation they become an App Developer or Owner-delegate within the granted Environments.

> **Not a persona:** the end-users of applications *built on* Blocks. They never sign into Blocks OS. They exist only as blocks-iam Users inside a tenant and are the subjects the console configures auth/roles for.

---

## 3. Terminology & Glossary

Canonical, customer-facing names per the product decisions. Where the code still uses a retired term, the migration is a known gap.

| Canonical term | Meaning | Retired / aliased term it replaces |
|---|---|---|
| **Project** | The top-level thing a customer creates and sees on the console. Backed internally by a tenant group (`tenantGroupId`). | "Tenant Group" as a customer-facing label (decision #330). Internal service/repository/persistence identifiers MAY remain `TenantGroup`. The word "Project" must be reserved for the top-level container only, not for individual environments. |
| **Environment** | One isolated instance of a Project (Development, Testing, Staging, IAT, UAT, Prod Shadow, Pre-Prod, Production). Implemented as a Tenant. | Customer-facing use of "Tenant" / "item" / "itemId". "Enviroment" (misspelling on the public wire contract) is being corrected (decision #333). |
| **X-Blocks-Key** | The Environment's tenant key/credential, shown to the developer to wire their app. | — (kept; this is the credential a customer copies) |
| **People** | Project collaborators (invited teammates) and their per-Environment access + roles. | "members" (a stray nav label). Standardize on "People". |
| **User** | A blocks-iam identity inside a tenant. A Person resolves to a User; tenants' own end-users are also Users. | — (technical/IAM term; distinct from "People" the collaborators) |
| **Owner** | The Project creator; a flag (`IsCreator`), not a stored role. Gate for invite / remove / transfer-ownership. | — |
| **My Services** (plural) | The customer-owned app-registration surface where a developer registers their backend service for telemetry. Canonical route `/app/secret-management/my-services`. | "My Service" (singular) and the `/managed-services` route (decision #329). |
| **Managed Services** | The platform-capability taxonomy (Blocks IAM / OS / Data / Utility / Release / Localization) used in subscription/product presentation. Distinct from "My Services". | Overloaded prior use of "Managed Service" for the customer's own registered service (decision #329 splits these). |
| **Logs & Traces** | The observability area: Usage, Tracing, Logs. | "LMT" (decision #339 — visual/label rename). Only logs + traces are implemented; no metrics are rendered today and none are planned in OS, so the "Monitoring" claim in "LMT" is dropped. |
| **Environment data migration** | Copying data from a source Environment to a target Environment, per service, with an overwrite toggle. | — |
| **Resource limits** | Per-tenant, data-driven quotas (Project, Environment, People/seats) held in a `ResourceLimits` collection. | Hardcoded-limit framing — limits are data-driven, not code constants (decision #325). |
| **Identity Provider / External IdP** | A federated external login provider (certificate/issuer/audience) configured under Secrets & Configs. | Should not be conflated with the security-settings section. |
| **Roles / Permissions / Organizations / OIDC / SSO** | Access-control and identity primitives, managed via blocks-iam screens embedded in the console. | — (owned by blocks-iam, not blocks-os) |

**Service identity (technical, decision #331):** the API's Swagger `ServiceName` and namespaces should read `blocks-os`. **Gap:** `server/Api/appsettings.json` still sets `ServiceName = "blocks-idp"` (stale; `idp` was renamed to `iam`). Client `@blocks-idp/*` aliases and the `blocks-idp::read-users` test scope are separate cleanups.

**Permission-scope grammar (decision #334):** canonical grammar is `service::area::action` (3 segments), action segment in kebab-case, prefix derived from a `ServiceName` constant. blocks-os is sequenced behind the identity fix #331.

---

## 4. Feature Catalog

| Feature | Description | Status | Notes |
|---|---|---|---|
| Project creation & tenant provisioning | 3-step wizard (Name → Add repositories → Configure environments) creates a tenant group and one tenant per Environment; async completion in the Worker seeds certs, owner, default roles/permissions/mail/storage/localization/schema, tracked by a resumable `ProjectStatusTracer`. | Shipped | `ProjectController`, `Worker/Consumers/Identifier/ConfigureProjectConsumer.cs` |
| Console / Project list | Lists the user's Projects as cards with Environment chips; drill-in opens an Environment. Capped at 10 Projects, 8 Environments. | Shipped | Limits are data-driven per tenant (decision #325), not code constants |
| Environments management | View/add Environments from 8 fixed tiers; read each Environment's `X-Blocks-Key`. | Shipped | 8 tiers are a fixed list (`environment-options.ts`) |
| Environment data migration | Copy data source→target Environment, per service, with per-service overwrite toggle; runs async, UI refreshes on notification. | Shipped | `components/environment-migration/` |
| People & access | Invite by email to chosen Environments with roles; resend invite/activation; remove access per Environment; transfer ownership. Owner-gated. | Shipped | `PeopleController`, `PeopleService` |
| Project Owner model | Single Owner = creator (`IsCreator`); ownership transferable to one other user across all Environments. | Shipped | Single-owner model; multi-owner is **Open** (see §9) |
| Repositories (GitHub) | Connect a GitHub account via OAuth; list and link repositories to the Project. | Shipped | `pages/repositories/`, `cross-modules/devops/` |
| My Services (managed-service registration) | Register an API/Worker service; provisions a Service Bus/RabbitMQ topic + log/trace subscriptions and a scoped connection string for telemetry. | Shipped | `ServiceController`; canonical name "My Services" (plural), route `/my-services` — **Gap:** code still "My Service" / `/managed-services` (#329) |
| Logs & Traces — Usage | Aggregate API-call metrics (total calls, avg response time, success/error counts). | Shipped | Area renamed from "LMT" (#339) |
| Logs & Traces — Tracing | Distributed request traces and per-trace timelines. | Shipped | `TraceController`, `Cloud.LmtService` |
| Logs & Traces — Logs | Searchable per-service logs, live tail, AI assistant. | Shipped | `LogController`, `LmtManagedServiceWorker` |
| Secrets & Configs hub | Grouping surface for secrets vault, storage, email, notifications, OIDC, client credentials, identity providers, external IdP/certificates, captcha, MFA. | Shipped | `constants/navigation-menus.ts` |
| Secrets vault | Per-tenant key/value secret CRUD. | v1 | `SecretsController`, `Secrets.DomainService`; UI gated. Adding scopes to `SecretsController` is deferred to a dedicated Secrets Management Epic (decision #327) |
| Storage / Email / Notification config | Per-tenant provider configuration (S3-compatible storage, SES mail, notifier types). | Shipped | `Storage/Mail/NotificationController`, `CloudConfiguration.DomainService` |
| Identity & auth admin (via blocks-iam) | OIDC clients + login branding, SSO, identity providers, client credentials (M2M), external IdP certs, roles, permissions, organizations, users, signup, token/auth settings. | Shipped | Embedded UI over blocks-iam; not implemented in this repo |
| MFA & captcha config (via Blocks Logic) | MFA and captcha settings screens. | Shipped | Calls `API_BASES.LOGIC`, not blocks-iam |
| API endpoint security ("API Settings") | Per-endpoint access controls: allow/deny, required roles, MFA/captcha requirement, rate limit, grouped by service/controller. | Shipped | `ApiEndpointConfigController`; `[Authorize]`-only is intentional for now (decision #327) |
| Custom domain & certificates | Verify/bind a custom domain (CNAME); configure nginx reverse-proxy vhosts and Let's Encrypt/certbot on remote hosts over SSH. | Shipped | `DomainController`, `DomainMangementService.cs`; `[Authorize]`-only intentional for now (#327) |
| Subscription & usage | Plan/usage overview across services with per-Environment breakdown. | v1 (partial) | LIMIT column wired to live per-tenant `ResourceLimits`; consumption numbers stay sample until #305 (decision #325) |
| Resource-limit enforcement | People/seat quota blocks invitations when exceeded; limits surfaced proactively on usage page + creation/invitation entry points. | v1 | Data-driven per tenant; **Gap:** `CopyAndCustomizeResourceLimitsAsync` seeding is disabled at `ProjectRepository.cs:314` (decision #325 Issue B) |
| Cross-links to Blocks suite | Login carousel + navigation to Construct, Cloud Build/Release, Agent Platform/AI, Data, Localization, Logic, Studio, Utilities via federated OAuth. | Shipped | `blocks-products.ts`, `endpoint.constant.ts` |
| CI test + coverage gate | PR-only CI job runs backend `dotnet test` and frontend `vitest run`; permanent flat 50% coverage floor (backend and frontend), CI-blocking only. | Roadmap | Enable via existing `RUN_TESTS` flag across `ci-dev/stg/prod` (decisions #341, #323); not gating local builds |
| Dedicated e2e environment | Isolated e2e env + DB with a seeded IdP account / service token as CI secret; per-app smoke suites under an e2e Epic. | Roadmap | Infrastructure work (decision #340) |

---

## 5. Key User Flows

### A. App Developer creates a Project
1. On the console ("Your Blocks Projects"), click **Add project** → the **Create a project** wizard opens.
2. **Step 1 — Name your project:** enter a name; accept the business-use and Terms-of-service checkboxes.
3. **Step 2 — Add resources:** click **Add repository** → connect GitHub via OAuth → select repositories. A "resource" here is a GitHub repository.
4. **Step 3 — Configure environments:** select one or more of the 8 tiers (Development, Testing, Staging, IAT, UAT, Prod Shadow, Pre-Prod, Production). A warning notes the repo branch name should match the Environment (e.g. `dev`; production → `main`). Submit.
5. The backend validates and returns a `tenantGroupId`, creating one tenant per Environment and publishing to the project listener queue. The Worker finishes setup asynchronously: generates certificates, inserts the creator as the `ProjectPeople` owner (`IsCreator=true`), seeds default roles/permissions/mail/storage/localization/schema, and records progress in a resumable `ProjectStatusTracer`.
6. The new Project appears on the console with its Environment chips.

### B. App Developer wires and observes an Environment
1. From the console, click an **Environment card** → the app opens the Environment ("Environment Overview", `/app/:itemId/dashboard`).
2. Copy the Environment's **X-Blocks-Key**, check custom-domain/CNAME status, and use the shown CLI/Git snippets to connect the app.
3. Under **Secrets & Configs → My Services**, register a service → receive a Service ID + connection string; the app uses the Blocks telemetry client to stream logs/traces.
4. Configure needed plumbing: storage/email/notification providers, OIDC/SSO, MFA, captcha, secrets, and per-endpoint API security.
5. Under **Logs & Traces**, watch **Usage** (API metrics), **Tracing** (drill from a trace to its timeline), and **Logs** (search per service, live tail, ask the AI assistant).

### C. Owner invites and manages People
1. In a Project's **People**, click **Invite** (Owner only).
2. Add recipient email(s), select the Environments to grant, add rows as needed, and **Send**. Each invite carries roles (default `["user"]`).
3. Backend: if the invitee has no blocks-iam User, publish a create-user event to the IAM queue; create per-Environment `ProjectPeople` grants; queue an invitation email with an `/invitation?code=…` link. The people-invitation link expires in **1 hour** (hardcoded and intentional; not configurable — decision #324).
4. Invitee opens the link → **Confirm invitation** → access is activated.
5. Owner can later **Resend Invitation/Activation**, **Remove access** (per Environment), or **Transfer Ownership** to another existing user.
6. If the tenant's People/seat resource limit is reached, the invitation is blocked; the limit is surfaced proactively on the usage page and at the invitation entry point (decision #325).

### D. Owner adds an Environment and migrates data
1. In **Environments**, click **New Environment** (Owner only; hidden once 8 exist) → pick the tier(s) → confirm (reminder: the matching repo branch should exist). A new tenant is provisioned.
2. To copy data, open the **data-migration wizard**: pick a **source** and **target** Environment, choose which services to migrate, and toggle **Overwrite data** per service → **Review & confirm**.
3. Migration runs asynchronously; the Environment card shows "Migration in progress," and the UI refreshes on the migration notification.

---

## 6. UX Principles & Default Behaviours

- **Project is the one customer-facing word for the top-level container.** "Tenant group" is internal only; "Project" is never used for an individual Environment (decision #330).
- **Environment is the one customer-facing word for an instance.** "Tenant"/"item" are internal; the `X-Blocks-Key` is presented as the Environment's credential (decision #333).
- **Logs & Traces, not LMT.** The observability area is labelled "Logs & Traces". No metrics/monitoring is claimed in OS because none is rendered today or planned here (decision #339). Deeper monitoring belongs to blocks-monitor.
- **My Services (plural) is the customer's own registered service; Managed Services is the platform-capability taxonomy.** The two are distinct surfaces and must not be conflated (decision #329).
- **Resource limits are transparent, not silent.** Enforced limits are data-driven per tenant and surfaced proactively at the usage page and at creation/invitation entry points — not only as a blocking error at the point of failure (decision #325).
- **Owner-gated destructive/administrative actions.** Invite, remove-access, and transfer-ownership are restricted to the Project Owner.
- **Async provisioning is resumable.** Project creation completes in the background and is tracked by a `ProjectStatusTracer` that resumes if it crashes.
- **Invitation links are short-lived and fixed.** People-invitation links expire in 1 hour with no owner/operator knob; the activation-email expiry is a different, separate value (decision #324).
- **Least-privilege default role.** Invitees default to the `"user"` role.
- **Consistency-only churn is avoided.** Renames that break URLs/re-grants/redirects without functional benefit are not actioned (decision #332); only real defects (e.g. Swagger schema typing on `TraceController.GetTraces`/`GetTrace`) are fixed.
- **Response envelopes are canonical and shared.** The single response envelope is owned by the shared `SeliseBlocks.Genesis` package; extensions are additive only (keep `IsSuccess`, `Errors`, `ItemId`; add an optional structured `ValidationErrors` field) — no per-repo envelopes (decision #336).

---

## 7. Functional Requirements & Acceptance Criteria

### FR-1 — Project creation
- **Given** an authenticated developer on the console, **when** they complete the 3-step wizard with a valid name, at least one repository, and at least one Environment tier, **then** the system creates a tenant group and one tenant per selected Environment, returns a `tenantGroupId`, and completes provisioning asynchronously (certs, owner grant, default seeds) tracked by a resumable status tracer.
- **Given** provisioning fails partway, **when** the Worker resumes, **then** it continues from the last recorded step rather than restarting from scratch.

### FR-2 — People invitation & seat limits
- **Given** a Project Owner invites an email to selected Environments, **when** the invitee has no blocks-iam User, **then** a create-user event is published, per-Environment `ProjectPeople` grants are created with the default `"user"` role, and an invitation email with a 1-hour link is queued.
- **Given** the tenant's People/seat resource limit is already reached, **when** the Owner attempts an invitation, **then** the invitation is blocked and the limit is shown proactively (not only as a failure at submit).
- **Given** a 1-hour invitation link has expired, **when** the invitee opens it, **then** it is invalid and the Owner must resend (self-service re-request is **Open** — see §9).

### FR-3 — Invitation confirmation authorization
- **Given** the intended access model for `ConfirmInvitation`, **when** the endpoint is called, **then** its authorization intent must be explicit — `[AllowAnonymous]` if the confirmation page is public, or a scoped attribute otherwise (decision #327).
- **Gap:** `PeopleController.ConfirmInvitation` currently carries no authorization attribute; intent must be made explicit.

### FR-4 — Logs authorization scope
- **Given** a user querying logs, **when** any `LogController` endpoint is called, **then** it must be gated by a log scope `blocks-os::log::gets` (consistent with `blocks-os::trace::gets`).
- **Gap:** all three `LogController` endpoints are currently gated by `blocks-os::mail::gets` (decision #279). The fix must ship together with a per-tenant seed/migration that registers `blocks-os::log::gets` in every tenant catalog and grants it to roles currently holding `blocks-os::mail::gets`, or tenants lose log access on deploy. **Open:** whether the live-log endpoint gets a separate `blocks-os::log::get-live` scope.

### FR-5 — Environment data migration
- **Given** an Owner selects a source and a target Environment and a set of services, **when** they confirm, **then** the chosen data is copied asynchronously, respecting the per-service overwrite toggle, and the Environment card reflects "Migration in progress" until a completion notification refreshes the UI.

### FR-6 — Managed-service (My Services) registration
- **Given** a developer registers a backend service in an Environment, **when** registration succeeds, **then** the system provisions a messaging topic with log/trace subscriptions and returns a Service ID + scoped connection string the service uses to stream telemetry.

### FR-7 — Resource-limit transparency
- **Given** enforced limits stored per tenant in `ResourceLimits` (`Resource`, `Limit`, `Usage`, `Lifetime`, `EnableAutoRenew`), **when** the usage page renders, **then** the LIMIT column reads live per-tenant data; consumption/usage may remain sample data until #305 lands.
- **Gap:** `CopyAndCustomizeResourceLimitsAsync` seeding is commented out at `ProjectRepository.cs:314`; without it new tenants lack seeded limits (decision #325 Issue B).

### FR-8 — Mail configuration read
- **Given** a request to read mail configuration, **when** configuration is missing, **then** the API returns a proper `404` (not-found) rather than throwing.
- **Gap:** `MailController.Get` currently returns HTTP 500 (NullReferenceException in `ConfigurationService.GetMailConfigurationAsync`, unguarded deref ~:256). Fix requires typing `Get`/`Gets` to `Task<IActionResult>`, adding the null guard, using 404 for not-found, and deleting the unreachable null branch in `Gets` (decision #328).

### FR-9 — Trace endpoint schema typing
- **Given** Swagger generation, **when** `TraceController.GetTraces`/`GetTrace` are documented, **then** they must declare concrete return types (not `Task<object>`) so a schema is produced. `GetOperationalAnalytics`/`GetServiceAnalytics` remain `Task<object>` (genuinely dynamic) (decision #332).

### FR-10 — CI test & coverage gate
- **Given** a pull request, **when** CI runs, **then** a PR-only job runs backend `dotnet test server/XUnitTest/XUnitTest.csproj` and frontend `npx vitest run` (via the existing `RUN_TESTS` flag across `ci-dev.yml`, `ci-stg.yml`, `ci_prod.yml`), and a push below a flat 50% coverage floor (backend and frontend independently) fails the CI check and blocks merge; local build/dev is never gated (decisions #341, #323).

---

## 8. Out of Scope / Roadmap

**Out of scope for Blocks OS (owned elsewhere):**
- Identity implementation — roles, permissions, users, organizations, OIDC/SSO, identity providers, client credentials, signup — is delivered by **blocks-iam**; the console only embeds its UI. The `Iam.DomainService`/`Iam.Driver` stubs here are not the implementation.
- MFA and captcha logic is delivered by **Blocks Logic**, not this repo.
- Deep monitoring — metrics, alerts, incidents, uptime — is the domain of **blocks-monitor**. Blocks OS renders no metrics and claims none; "Logs & Traces" is logs + traces only (decision #339).
- Data CRUD and dynamic-schema gateway behaviour is **blocks-data**; translation management is **blocks-localization**. Blocks OS only provisions default data/schemas/language seeds into new tenants.

**Roadmap / not-yet-complete in this build:**
- **CI test + coverage enforcement** (decisions #341, #323): enable the `RUN_TESTS` gate and the permanent flat 50% floor. No ramp/ladder; any future raise is a separate explicit decision.
- **Dedicated e2e environment** (decision #340): isolated env + DB, seeded CI IdP account/service token, per-app smoke suites under an e2e Epic.
- **Real subscription usage** (decision #325, pending #305): live consumption/usage numbers replacing the current sample data; LIMIT column is already live per tenant.
- **Resource-limit seeding fix** (decision #325 Issue B): re-enable `CopyAndCustomizeResourceLimitsAsync`.
- **Service-identity alignment** (decision #331): `blocks-idp` → `blocks-os` across Swagger `ServiceName`, namespaces, and derived permission prefix; client `@blocks-idp/*` alias rename to `blocks-iam`.
- **Permission-scope grammar migration** (decision #334): adopt derived `service::area::action` kebab-case prefix, sequenced behind #331.
- **Customer-facing terminology migration** (decisions #329, #330, #333, #339): "My Services" plural + `/my-services` route with redirect; "Project" (drop customer-facing "tenant group"); fix the "Enviroment" wire-contract misspelling as a coordinated cross-repo contract migration; "Logs & Traces" label.
- **Shared client libs into blocks-kit** (decision #335) and **canonical Genesis response envelope** (decision #336): additive, phased, one PR per file/step.
- **Naming-conventions documentation** (decision #338) and **separate `vitest.config.ts` standardization** (decision #337): document/standardize now, no CI enforcement yet.
- **Secrets Management Epic** (decision #327): dedicated refactor of `SecretsController` authz — not addressed piecemeal here.

**Explicitly rejected (not roadmap):**
- blocks-os-owned permission seed folder/changes — `blocks-os::*` permissions are handled outside this service (decision #326).
- Consistency-only endpoint renames with no functional benefit (decision #332).
- Scoped authz on `ApiEndpointConfigController` and `DomainController` — `[Authorize]`-only is intentional for now (decision #327).

---

## 9. Open Product Questions

- **Multi-owner Projects (B1):** the model is currently a single Owner (the creator) with transfer to one other user. Whether Projects should support multiple owners/admins so a Project is not stranded if one person leaves is **Open / undecided**.
- **Explicit invite-time role selection (B2):** invitees default to `"user"`. Whether the inviter should explicitly choose the invitee's role at invite time, and what the sensible default should be, is **Open / undecided**.
- **Custom Environment naming vs fixed tiers (B3):** the 8 tiers are a fixed list and adding one warns that a matching code branch must exist. Whether customers should name their own Environments, and whether the branch-must-exist rule is a hard requirement customers will understand, is **Open / undecided**.
- **"Impersonation" mental model (B4):** entering an Environment is implemented as tenant "impersonation". Whether this is the right customer-facing mental model/word (vs simply "opening" an Environment) is **Open / undecided**.
- **Post-expiry invitation self-service (B5):** whether an invitee can self-request a new link after the 1-hour expiry, or must wait for an Owner to resend, is **Open / undecided** (the 1-hour value itself is decided/fixed — #324).
- **Provisioning-progress UX and failure notification (B6):** what the customer sees during async provisioning and whether they are notified on partial failure is **Open / undecided** (a resumable tracer exists internally).
- **Project/Environment cap as plan rule vs temporary (B7):** the 10-Project / 8-Environment caps currently apply regardless of plan; whether they are intended plan-tied product rules or temporary is **Open / undecided** (limits are data-driven per #325, enabling subscription-based values later).
- **Billing & quotas today (C2):** whether real billing and usage quotas exist today or the usage page is a preview of a future capability is **Open / undecided** (only the per-tenant People/seat limit is enforced now).
- **Disabled capabilities' fate (C4):** "My Secret" (personal secrets), "Magic URL" (passwordless magic links), "AI Models", and a translation/localization manager are present but switched off. Whether these are planned for launch, deprioritized, or cut is **Open / undecided**.
- **Custom-domain promise & ownership (C5):** the customer-facing promised experience/turnaround for custom-domain validation, and who is responsible when validation fails, is **Open / undecided**.
- **Data-migration business intent & overwrite safeguards (C6):** the primary customer reason for Environment data migration and what safeguards should wrap the "overwrite" option are **Open / undecided**.
- **Automatic seeding opt-out (D5):** whether customers should be able to opt out of, or choose, the default data/schema/language seeding on Project creation is **Open / undecided**.
- **Hub vs peer positioning (D6):** whether Blocks OS is positioned as the single front door/hub for the entire Blocks platform or one product among peers is **Open / undecided**.
- **Live-log scope split (FR-4 / #279):** whether the live-log endpoint gets its own `blocks-os::log::get-live` scope or all three log endpoints share one is **Open / undecided**.

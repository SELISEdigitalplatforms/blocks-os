# Blocks OS — Business Specification

> Status: Authoritative business specification for the `blocks-os` service. Grounded in the current codebase (@ inception) and reconciled against the answered-ticket / product-owner decisions captured for this repo. Where the shipped code differs from a decision, the decision is the TARGET and the gap is called out inline as **Gap**.

## 1. Overview

Blocks OS is the **central console and control plane** of the SELISE Blocks platform. It is the single screen a development team uses to stand up and operate an application on Blocks: create a **Project**, split it into named **Environments** (Development, Staging, Production, and more), invite **People** and manage their per-environment access, connect GitHub repositories, register their own backend services for telemetry, and configure and observe the platform capabilities those environments run on (identity/auth, secrets, storage, email, notifications, custom domains, API-endpoint security, and Logs & Traces). It solves the day-0 / day-2 operations problem: instead of wiring each backing service by hand, a team gets isolated, pre-provisioned tenants (with certificates, database, domain, default admin, and seeded roles/config) and one operator surface to secure and monitor them. The product is named **"Blocks OS"** in the UI and Swagger surface.

## 2. Problem & Market Context

Teams building cloud applications repeatedly re-solve the same undifferentiated setup: multi-tenant isolation, an identity/auth stack, per-environment configuration, secrets handling, custom domains and certificates, and centralized observability — before writing any product logic. Doing this by hand is slow, error-prone, and hard to keep consistent across dev → staging → production.

Blocks OS addresses this by making the environment itself a managed, self-service object. The market context is internal-developer-platform (IDP) / application-platform tooling: the buyer is a team that wants a paved road from "new project" to "running, secured, observable environment" without operating the underlying identity, data, and monitoring plumbing themselves. Blocks OS is the front door to that paved road; the sibling Blocks services provide the plumbing behind it.

## 3. Value Proposition & Positioning

**Positioning:** Blocks OS is the **console / control plane** for SELISE Blocks — the place teams create and operate Projects, Environments, and People, and reach the configuration and observability of every other Blocks capability from one place.

Core value:
- **Provision in minutes, not weeks.** Creating a Project provisions one isolated tenant per Environment, each with signing certificates, database, domains, a default owner/admin, and seeded default roles, permissions, mail, storage, localization, and schema.
- **One operator surface.** Identity/auth, secrets, storage, email, notifications, custom domains, API-endpoint security, and Logs & Traces are all reached from the console, per Environment.
- **Multi-environment SDLC.** Fixed environment tiers plus environment-to-environment data migration support a develop → validate → release flow.
- **Self-service administration.** Teams configure their own SSO/OIDC/MFA/captcha, secrets, providers, and domains without filing tickets to a platform team.

**It is explicitly NOT:**
- **NOT the identity system itself.** Roles, permissions, users, organizations, OIDC/SSO are delivered by **Blocks IAM**; Blocks OS is the front door and provisioner, not the owner of that logic (the in-repo IAM server projects are empty stubs).
- **NOT the data gateway.** Data CRUD is **Blocks Data**; Blocks OS only seeds and links to it.
- **NOT a metrics/alerting monitoring product.** The observability area is **Logs & Traces** only — there are no metrics or alerts rendered today and none planned in Blocks OS (that is Blocks Monitor's domain). The legacy "LMT" label is retired in favor of "Logs & Traces" (decision #339).
- **NOT a billing engine.** The Subscription Usage view is a preview; resource limits are enforced but plan-based billing is undecided.

## 4. Target Customers & Personas

**Primary persona: the App Developer / team building on Blocks.** This is the same individual who, as project creator, becomes the **Owner** — so the developer and the tenant administrator are usually one person. They create Projects, pick Environments, connect repositories, register services, configure plumbing, and debug via Logs & Traces.

Personas that apply:

- **App Developer (primary).** Creates a Project, selects Environments, connects GitHub repos, copies the Environment's `X-Blocks-Key` and CLI/Git snippets to wire the app, registers backend services ("My Service") to stream telemetry, and debugs with Logs & Traces (Usage / Tracing / Logs).
- **Project Owner / tenant administrator.** In practice the project creator (`isCreator` on ProjectPeople). Invites People to specific Environments, resends invitations, removes access per Environment, transfers ownership, renames the Project, adds Environments (up to 8), and runs environment-to-environment data migration. Invite / remove / transfer are Owner-gated.
- **Invited collaborator (People).** A teammate invited by email to specific Environments; touches the public invitation-accept page to activate access.
- **Platform / root operator (infrastructure role).** A `RootTenantId` and a platform `BlocksConfiguration` source database seed new tenants. This operator runs the Blocks platform itself; there are no dedicated console screens for this role today — it is an infrastructure-level role, not a console persona.

**Not a persona:** the tenant's own end-users. People who use applications *built on* Blocks never sign into Blocks OS; they exist only as IAM Users inside a tenant.

## 5. Business Use Cases

- **Stand up a new application backend fast.** A team creates a Project and receives isolated dev → prod Environments with auth, storage, mail, and schemas pre-seeded, connects a GitHub repo, and starts building.
- **Multi-environment SDLC with promotion.** Named tiers plus environment-to-environment data migration support develop → validate → release, with a repo-branch-per-environment convention.
- **Team collaboration with least-privilege access.** Owners invite teammates to specific Environments with roles, revoke access per Environment, and hand over ownership — supporting agencies and teams managing client work and staff turnover.
- **Self-service platform administration.** Tenant admins configure their own SSO/OIDC/MFA/captcha, secrets, storage, email, notifications, custom domains, and API-endpoint security instead of raising tickets.
- **Built-in observability for a team's own services.** Teams register their services and get centralized logs, request traces, and API-usage analytics (with an AI assistant to query logs) without operating their own stack.
- **Central hub across the Blocks suite.** One console federates (via OIDC single sign-on) into sibling Blocks products, giving a unified operator surface.

## 6. Where it fits in the SELISE Blocks platform

Blocks OS is the **hub and provisioning layer** the other four services sit beneath. It does not replace them; it creates the tenants they operate in and hosts (or embeds) the admin UI for them. Every service is .NET (`server/`) + React/Vite (`client/`), multi-tenant via an `X-Blocks-Key` tenant key, and authenticates through Blocks IAM via OIDC.

- **Blocks IAM (identity & access).** Blocks OS is the **front door and provisioner** for IAM. On Project creation it seeds default Roles, Permissions, and Identity configuration into each new tenant and creates users by publishing to the IAM message queue. The console's Roles, Permissions, Users, Organizations, OIDC, SSO, Identity Providers, Client Credentials, and Signup screens are UIs that call Blocks IAM directly. **Boundary:** identity logic lives in IAM, not here. (MFA and captcha configuration screens call a separate "Blocks Logic" service, not IAM — an intentional split today.)
- **Blocks Data (dynamic-schema data gateway, GraphQL over MongoDB + object Storage).** Blocks OS provisions default schema definitions / tenant configurations into new tenants and enqueues data cleanup/migration work. It does not implement data CRUD; it seeds and links.
- **Blocks Localization (translation management).** Project provisioning seeds default languages, modules, and keys into new tenants, and environment data-migration can move language data. A localization module exists in the client but is not currently routed into the console shell.
- **Blocks Monitor (uptime monitoring, incidents, alerts).** Blocks OS operates its own **Logs & Traces** pipeline (registered services stream telemetry over Service Bus / RabbitMQ; a worker ingests it into Mongo; a query service serves it). This is logs + traces only — **not** metrics/alerts. Uptime monitoring, incidents, and alerts belong to Blocks Monitor. **Gap:** a `serviceAccessResourceName` was mis-set to `blocks-os` inside blocks-monitor's Program.cs; decision #339 corrects it to `blocks-monitor`.

The console also federates via OIDC to other Blocks products referenced in the login carousel and runtime config (e.g. Construct/SDK, Cloud Build/Release, Agent Platform/AI, Logic, Studio, Utilities), each with its own base URL and OAuth client id.

## 7. Success Metrics / KPIs

**Open / undecided:** no formal business KPI set is defined in the code or decisions. Candidate metrics implied by the product surface (to be confirmed by product owners):

- Time-to-first-Environment (Project create → provisioning complete).
- Projects created and Environments provisioned per tenant.
- People invited and invitation activation rate.
- Services registered per Environment (proxy for observability adoption).
- Logs & Traces query volume / active usage.
- Resource-limit hit rate (how often tenants reach seat/project/environment quotas) — available because limits and usage are tracked per tenant in the `ResourceLimits` collection.

## 8. Pricing, Packaging & Limits

- **Enforced limits are data-driven per tenant**, not hardcoded (decision #325). They live in a `ResourceLimits` collection with fields `Resource`, `ResourceType`, `Limit`, `Usage`, `Lifetime`, `EnableAutoRenew`, `IsActive`, `TenantId`, `Type`. Because they are seeded data, they can become subscription-based later without a code change.
- **The limit that blocks invitations is a people/seat quota** (`QUOTA_REDIRECT_CONFIG.PEOPLE` → `/people`), read from seeded per-tenant data, distinct from Project and Environment limits.
- **Limits must be surfaced proactively** — on the usage page and at creation/invitation entry points — not only as a blocking error at the point of failure (decision #325). On the preview usage page the LIMIT column is wired to live per-tenant data; consumption/usage numbers stay as sample data until real usage tracking lands.
- **Documented limit set:** Project, Environment, People/seats, and any IAM quota, with `ResourceLimits` as the source of truth. There is currently **no customer-facing documentation** of the enforced limit set (decision #325 calls for creating it).
- **Observed hard caps in the current UI:** up to 10 Projects and up to 8 Environments per Project. **Open / undecided:** whether these are permanent product rules or plan-tied; they currently apply regardless of plan.
- **Invitation link expiry is a fixed 1 hour**, intentionally non-configurable — no owner/operator knob, no per-Project/per-invitation scope (decision #324). The People-invite expiry and the activation-email expiry are two different values.
- **Billing / plans: Open / undecided.** The Subscription Usage view is a preview (usage numbers are sample data; plan labels such as "Free"/"Enterprise" appear inconsistently). Whether there is real billing and plan-based quotas today is undecided; only per-tenant resource limits are enforced now.

**Gap:** the seeding path that copies resource limits into a new tenant (`CopyAndCustomizeResourceLimitsAsync`, disabled at `ProjectRepository.cs:314`) must be fixed so per-tenant limits are populated on provisioning (decision #325, Issue B).

## 9. Scope & Non-Goals

**v1 scope (in the console today):**
- Project creation and per-Environment tenant provisioning (async, resumable via a status tracer).
- Console / Project list; Environment management (view/add up to 8 tiers; view `X-Blocks-Key`).
- People & access: invite by email to chosen Environments, resend, remove per Environment, transfer ownership (Owner-gated).
- Environment-to-environment data migration (source → target, per service, with overwrite toggles).
- GitHub repository connect/link.
- **My Services** — registering a customer's own backend service to receive a Service ID + connection string for telemetry.
- **Logs & Traces** — Usage (API metrics), Tracing (request traces), Logs (search, live tail, AI assistant). Logs + traces only.
- Secrets, Storage, Email, Notification configuration per tenant.
- Identity & auth admin surfaced via Blocks IAM (and MFA/captcha via Blocks Logic).
- API endpoint security ("API Settings").
- Custom domain & certificate binding (SSH-driven nginx/certbot on proxy hosts).
- Subscription & usage view (preview).

**Canonical terminology (decided):**
- **Project** is the customer-facing term for what is internally a "tenant group"; the customer-facing surface (endpoint/route/DTO/client constants) is renamed off "tenant group" while internal service/persistence identifiers may remain `TenantGroup` (decision #330).
- **Environment** is the customer-facing term for a per-tenant instance (`X-Blocks-Key` is the environment's tenant key/credential the developer copies).
- **People** is the standard term for invited collaborators (not "members").
- **My Services** (plural) is the customer-owned app-registration surface, at `/app/secret-management/my-services` with a redirect from the old `/managed-services` path (decision #329). Separately, **Managed Services** is the platform-capability taxonomy (IAM / OS / Data / Utility / Release / Localization) used in subscription/product presentation — tracked as its own work item, not the app-registration screen.
- **Logs & Traces** replaces the "LMT" label (decision #339).

**Non-goals (v1):**
- Metrics, alerting, incident management, uptime monitoring (Blocks Monitor's domain).
- Owning identity logic — roles/permissions/users/orgs/OIDC/SSO remain Blocks IAM.
- Data CRUD — remains Blocks Data.
- Plan-based billing and quota enforcement beyond the current data-driven resource limits.
- Customer-defined / freely-named Environment tiers (tiers are a fixed list today — see Open Questions).
- **Gap — service identity:** the backend still self-identifies as `blocks-idp` (`ServiceName` in appsettings). Decision #331 makes the target identity **blocks-os** (Swagger ServiceName, root namespace, controller namespaces, and the derived permission prefix). Until aligned, the on-the-wire identity is stale.

**Roadmap / present-but-disabled (not cut):** My Secret (personal secrets), Magic URL (passwordless), AI Models, and the localization/UILM manager are present in code but switched off in the current build. **Open / undecided:** whether each is planned for launch, deprioritized, or cut.

## 10. Open Business Questions

- **Environment tiers (B3):** should the eight tiers (Development, Testing, Staging, IAT, UAT, Prod Shadow, Pre-Prod, Production) stay a fixed list, or should customers name their own? Is the "a matching code branch must already exist" rule a hard requirement customers will understand?
- **Multiple owners (B1):** is a single Owner (the creator, transferable to one other person) the intended model, or should Projects support multiple owners/admins so a Project isn't stranded when one person leaves?
- **Invite-time roles (B2):** should the inviter explicitly choose the invitee's role at invite time, and what is the sensible default (currently a basic "user" role, or the inviter's own roles)?
- **Project/Environment caps (B7):** are the 10-Project / 8-Environment limits permanent product rules or plan-tied? They currently apply regardless of plan.
- **Billing & quotas (C2):** is there real billing and are there usage quotas today, or is Subscription Usage purely a preview of a future capability?
- **Disabled capabilities (C4):** are My Secret, Magic URL, AI Models, and the localization manager planned for launch, deprioritized, or cut?
- **Custom-domain SLA (C5):** what is the promised experience and turnaround for a custom domain, and who owns resolution when validation fails?
- **Data-migration intent & safeguards (C6):** what is the primary business reason customers migrate data (seed a new Environment vs refresh staging from production), and what safeguards should guard the "overwrite" option?
- **Automatic seeding opt-out (D5):** should customers be able to opt out of, or choose, the default Data/Localization seeding applied to new Environments?
- **Identity boundary (D1/D2):** long-term, is Blocks OS the single place customers manage identity, or should some of it (organizations, end-users) move to the IAM product directly? What must stay in the console?
- **Security-settings cohesion (D3):** should MFA/captcha (Blocks Logic) and the rest of identity (Blocks IAM) feel like one place to customers, or is the split acceptable?
- **Hub positioning (D6):** is Blocks OS positioned as the single front door / hub for the entire Blocks platform, or as one product among peers? This drives how prominently it is marketed.
- **Impersonation wording (B4):** is "impersonation" the right customer mental model for entering an Environment, or should it simply feel like "opening" it?
- **Success metrics (Section 7):** no KPI set is decided; the candidate list above needs product-owner confirmation.

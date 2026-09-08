/**
 * TypeScript mirror of features.mjs — keep both files in sync when adding features.
 * The runner reads features.mjs; this file is for IDE autocomplete if needed.
 */
export type OsFeature = {
  id: string
  name: string
  enabled: boolean
  spec: string
}

export const OS_FEATURES: OsFeature[] = [
  {
    id: "overview",
    name: "Overview — dashboard / domains",
    enabled: true,
    spec: "tests/01-overview/overview-flow.spec.ts",
  },
  {
    id: "secret",
    name: "Secrets & Configs — Secret",
    enabled: true,
    spec: "tests/02-secrets-and-configs/01-secret-flow.spec.ts",
  },
  {
    id: "my-services",
    name: "Secrets & Configs — My Services",
    enabled: true,
    spec: "tests/02-secrets-and-configs/02-my-services-flow.spec.ts",
  },
  {
    id: "oidc",
    name: "Secrets & Configs — OIDC",
    enabled: true,
    spec: "tests/02-secrets-and-configs/03-oidc-flow.spec.ts",
  },
  {
    id: "client-credentials",
    name: "Secrets & Configs — Client Credentials",
    enabled: true,
    spec: "tests/02-secrets-and-configs/04-client-credentials-flow.spec.ts",
  },
  {
    id: "identity-provider",
    name: "Secrets & Configs — Identity Provider",
    enabled: true,
    spec: "tests/02-secrets-and-configs/05-identity-provider-flow.spec.ts",
  },
  {
    id: "external-idp",
    name: "Secrets & Configs — External IdP",
    enabled: true,
    spec: "tests/02-secrets-and-configs/06-external-idp-flow.spec.ts",
  },
  {
    id: "captcha",
    name: "Secrets & Configs — Captcha",
    enabled: true,
    spec: "tests/02-secrets-and-configs/07-captcha-flow.spec.ts",
  },
  {
    id: "mfa",
    name: "Secrets & Configs — MFA",
    enabled: true,
    spec: "tests/02-secrets-and-configs/08-mfa-flow.spec.ts",
  },
  {
    id: "email-secret",
    name: "Secrets & Configs — Email",
    enabled: true,
    spec: "tests/02-secrets-and-configs/09-email-flow.spec.ts",
  },
  {
    id: "notification",
    name: "Secrets & Configs — Notification",
    enabled: true,
    spec: "tests/02-secrets-and-configs/10-notification-flow.spec.ts",
  },
  {
    id: "storage",
    name: "Secrets & Configs — Storage",
    enabled: true,
    spec: "tests/02-secrets-and-configs/11-storage-flow.spec.ts",
  },
  {
    id: "email-management",
    name: "Email Management",
    enabled: true,
    spec: "tests/03-email-management/email-management-flow.spec.ts",
  },
  {
    id: "iam-settings",
    name: "Identity & Access — Settings",
    enabled: true,
    spec: "tests/04-identity-and-access/01-settings-flow.spec.ts",
  },
  {
    id: "users",
    name: "Identity & Access — Users & Organizations",
    enabled: true,
    spec: "tests/04-identity-and-access/02-users-flow.spec.ts",
  },
  {
    id: "organizations",
    name: "Identity & Access — Organizations (merged into users)",
    enabled: false,
    spec: "tests/04-identity-and-access/02-users-flow.spec.ts",
  },
  {
    id: "roles",
    name: "Identity & Access — Roles",
    enabled: true,
    spec: "tests/04-identity-and-access/04-roles-flow.spec.ts",
  },
  {
    id: "permissions",
    name: "Identity & Access — Permissions",
    enabled: true,
    spec: "tests/04-identity-and-access/05-permissions-flow.spec.ts",
  },
  {
    id: "usage",
    name: "Logs & Traces — Usage",
    enabled: true,
    spec: "tests/05-logs-and-traces/01-usage-flow.spec.ts",
  },
  {
    id: "tracing",
    name: "Logs & Traces — Tracing",
    enabled: true,
    spec: "tests/05-logs-and-traces/02-tracing-flow.spec.ts",
  },
  {
    id: "logs",
    name: "Logs & Traces — Logs",
    enabled: true,
    spec: "tests/05-logs-and-traces/03-logs-flow.spec.ts",
  },
  {
    id: "repositories",
    name: "Project Settings — Repositories",
    enabled: true,
    spec: "tests/06-project-settings/01-repositories-flow.spec.ts",
  },
  {
    id: "project-settings",
    name: "Project Settings — Settings",
    enabled: true,
    spec: "tests/06-project-settings/02-project-settings-flow.spec.ts",
  },
  {
    id: "environments",
    name: "Project Settings — Add environment",
    enabled: true,
    spec: "tests/06-project-settings/03-environments-flow.spec.ts",
  },
  {
    id: "people",
    name: "Project Settings — People invite",
    enabled: true,
    spec: "tests/06-project-settings/04-people-flow.spec.ts",
  },
  {
    id: "migration",
    name: "Project Settings — Start migration",
    enabled: true,
    spec: "tests/06-project-settings/05-migration-flow.spec.ts",
  },
]

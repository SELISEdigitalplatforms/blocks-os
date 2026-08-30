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
    spec: "tests/overview/overview-flow.spec.ts",
  },
  {
    id: "users",
    name: "Identity & Access — Users",
    enabled: true,
    spec: "tests/identity-and-access/users-flow.spec.ts",
  },
  {
    id: "roles",
    name: "Identity & Access — Roles",
    enabled: true,
    spec: "tests/identity-and-access/roles-flow.spec.ts",
  },
  {
    id: "permissions",
    name: "Identity & Access — Permissions",
    enabled: true,
    spec: "tests/identity-and-access/permissions-flow.spec.ts",
  },
  {
    id: "organizations",
    name: "Identity & Access — Organizations",
    enabled: true,
    spec: "tests/identity-and-access/organizations-flow.spec.ts",
  },
  {
    id: "iam-settings",
    name: "Identity & Access — Settings",
    enabled: true,
    spec: "tests/identity-and-access/settings-flow.spec.ts",
  },
  {
    id: "secret",
    name: "Secrets & Configs — Secret",
    enabled: true,
    spec: "tests/secrets-and-configs/secret-flow.spec.ts",
  },
  {
    id: "oidc",
    name: "Secrets & Configs — OIDC",
    enabled: true,
    spec: "tests/secrets-and-configs/oidc-flow.spec.ts",
  },
  {
    id: "client-credentials",
    name: "Secrets & Configs — Client Credentials",
    enabled: true,
    spec: "tests/secrets-and-configs/client-credentials-flow.spec.ts",
  },
  {
    id: "identity-provider",
    name: "Secrets & Configs — Identity Provider",
    enabled: true,
    spec: "tests/secrets-and-configs/identity-provider-flow.spec.ts",
  },
  {
    id: "external-idp",
    name: "Secrets & Configs — External IdP",
    enabled: true,
    spec: "tests/secrets-and-configs/external-idp-flow.spec.ts",
  },
  {
    id: "captcha",
    name: "Secrets & Configs — Captcha",
    enabled: true,
    spec: "tests/secrets-and-configs/captcha-flow.spec.ts",
  },
  {
    id: "mfa",
    name: "Secrets & Configs — MFA",
    enabled: true,
    spec: "tests/secrets-and-configs/mfa-flow.spec.ts",
  },
  {
    id: "email-secret",
    name: "Secrets & Configs — Email",
    enabled: true,
    spec: "tests/secrets-and-configs/email-flow.spec.ts",
  },
  {
    id: "notification",
    name: "Secrets & Configs — Notification",
    enabled: true,
    spec: "tests/secrets-and-configs/notification-flow.spec.ts",
  },
  {
    id: "storage",
    name: "Secrets & Configs — Storage",
    enabled: true,
    spec: "tests/secrets-and-configs/storage-flow.spec.ts",
  },
  {
    id: "my-services",
    name: "Secrets & Configs — My Services",
    enabled: true,
    spec: "tests/secrets-and-configs/my-services-flow.spec.ts",
  },
  {
    id: "people",
    name: "Project Settings — People",
    enabled: true,
    spec: "tests/project-settings/people-flow.spec.ts",
  },
  {
    id: "environments",
    name: "Project Settings — Environments",
    enabled: true,
    spec: "tests/project-settings/environments-flow.spec.ts",
  },
  {
    id: "repositories",
    name: "Project Settings — Repositories",
    enabled: true,
    spec: "tests/project-settings/repositories-flow.spec.ts",
  },
  {
    id: "project-settings",
    name: "Project Settings — Settings",
    enabled: true,
    spec: "tests/project-settings/project-settings-flow.spec.ts",
  },
  {
    id: "logs",
    name: "Logs & Traces — Logs",
    enabled: true,
    spec: "tests/logs-and-traces/logs-flow.spec.ts",
  },
  {
    id: "tracing",
    name: "Logs & Traces — Tracing",
    enabled: true,
    spec: "tests/logs-and-traces/tracing-flow.spec.ts",
  },
  {
    id: "usage",
    name: "Logs & Traces — Usage",
    enabled: true,
    spec: "tests/logs-and-traces/usage-flow.spec.ts",
  },
  {
    id: "email-management",
    name: "Email Management",
    enabled: true,
    spec: "tests/email-management/email-management-flow.spec.ts",
  },
]

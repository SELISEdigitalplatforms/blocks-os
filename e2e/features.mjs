/**
 * Blocks OS E2E feature list — edit `enabled` and order here.
 * `npm test` / `npm run test:features` run specs in this array order.
 *
 * Suite order follows the product sidebar (all on Development), then
 * project-settings work that mutates environments:
 *   Overview
 *   → Secrets & Configs (submenu)
 *   → Email Management
 *   → Identity & Access (submenu)
 *   → Logs & Traces (submenu)
 *   → add environment → people invite → start migration
 *
 * Env: E2E_FEATURES=overview,users  or  E2E_FEATURES=all
 */

/** @type {{ id: string, name: string, enabled: boolean, spec: string }[]} */
export const OS_FEATURES = [
  {
    id: "overview",
    name: "Overview — dashboard / domains",
    enabled: true,
    spec: "tests/01-overview/overview-flow.spec.ts",
  },

  // Secrets & Configs (sidebar submenu order)
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

  // Identity & Access (sidebar submenu order)
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

  // Logs & Traces (sidebar submenu order)
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

  // Still on Development (project configure, not the product sidebar)
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

  // After every Development sidebar flow: add env → people invite → migrate
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

export function resolveEnabledFeatures() {
  const override = process.env.E2E_FEATURES?.trim()

  if (!override || override === "all") {
    return OS_FEATURES.filter((feature) => feature.enabled)
  }

  const ids = override.split(",").map((id) => id.trim()).filter(Boolean)
  /** @type {typeof OS_FEATURES} */
  const selected = []

  for (const id of ids) {
    const feature = OS_FEATURES.find((entry) => entry.id === id)
    if (!feature) {
      throw new Error(
        `Unknown E2E feature "${id}". Valid ids: ${OS_FEATURES.map((f) => f.id).join(", ")}`,
      )
    }
    selected.push(feature)
  }

  return selected
}

/** Spec files in suite order, including login + os-setup so project filters still match. */
export function orderedSuiteSpecs() {
  return [
    "tests/auth/login.spec.ts",
    "tests/suite/suite.setup.spec.ts",
    ...resolveEnabledFeatures().map((feature) => feature.spec),
  ]
}

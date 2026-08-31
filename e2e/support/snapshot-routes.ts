import { expect, type Page } from "@playwright/test"
import {
  openEmailManagement,
  openIam,
  openLmt,
  openOsDashboard,
  openProjectOverview,
  openSecretManagement,
} from "./os-helpers"

export type SnapshotRoute = {
  id: string
  name: string
  navigate: (page: Page) => Promise<void>
  waitForReady?: (page: Page) => Promise<void>
}

/** One route per feature id in features.mjs — used to pre-capture page snapshots locally. */
export const SNAPSHOT_ROUTES: SnapshotRoute[] = [
  {
    id: "overview",
    name: "Overview — dashboard / domains",
    navigate: (page) => openOsDashboard(page),
  },
  {
    id: "users",
    name: "Identity & Access — Users",
    navigate: (page) => openIam(page, "user", "Users"),
  },
  {
    id: "roles",
    name: "Identity & Access — Roles",
    navigate: (page) => openIam(page, "role", "Roles"),
  },
  {
    id: "permissions",
    name: "Identity & Access — Permissions",
    navigate: (page) => openIam(page, "permission", "Permissions"),
  },
  {
    id: "organizations",
    name: "Identity & Access — Organizations",
    navigate: (page) => openIam(page, "organization", /^Organizations$/),
  },
  {
    id: "iam-settings",
    name: "Identity & Access — Settings",
    navigate: (page) => openIam(page, "settings", "Auth Configuration"),
  },
  {
    id: "secret",
    name: "Secrets & Configs — Secret",
    navigate: (page) => openSecretManagement(page, "secret", "Secret"),
  },
  {
    id: "oidc",
    name: "Secrets & Configs — OIDC",
    navigate: (page) => openSecretManagement(page, "oidc", "OIDC"),
  },
  {
    id: "client-credentials",
    name: "Secrets & Configs — Client Credentials",
    navigate: (page) => openSecretManagement(page, "client-credentials", "Client Credentials"),
  },
  {
    id: "identity-provider",
    name: "Secrets & Configs — Identity Provider",
    navigate: (page) => openSecretManagement(page, "identity-providers", "Identity Provider"),
  },
  {
    id: "external-idp",
    name: "Secrets & Configs — External IdP",
    navigate: (page) => openSecretManagement(page, "external-idp", "External IdP"),
  },
  {
    id: "captcha",
    name: "Secrets & Configs — Captcha",
    navigate: (page) => openSecretManagement(page, "captcha", "Captcha"),
  },
  {
    id: "mfa",
    name: "Secrets & Configs — MFA",
    navigate: (page) => openSecretManagement(page, "mfa", "MFA"),
  },
  {
    id: "email-secret",
    name: "Secrets & Configs — Email",
    navigate: (page) => openSecretManagement(page, "email", "Email"),
  },
  {
    id: "notification",
    name: "Secrets & Configs — Notification",
    navigate: (page) => openSecretManagement(page, "notification", "Notification"),
  },
  {
    id: "storage",
    name: "Secrets & Configs — Storage",
    navigate: (page) => openSecretManagement(page, "storage", "Storage"),
  },
  {
    id: "my-services",
    name: "Secrets & Configs — My Services",
    navigate: (page) => openSecretManagement(page, "my-services", "My Services"),
  },
  {
    id: "people",
    name: "Project Settings — People",
    navigate: (page) => openProjectOverview(page, "people"),
  },
  {
    id: "environments",
    name: "Project Settings — Environments",
    navigate: (page) => openProjectOverview(page, "environments"),
  },
  {
    id: "repositories",
    name: "Project Settings — Repositories",
    navigate: (page) => openProjectOverview(page, "repositories"),
    waitForReady: async (page) => {
      await expect(page.getByRole("heading", { name: "Repositories" })).toBeVisible({
        timeout: 30_000,
      })
    },
  },
  {
    id: "project-settings",
    name: "Project Settings — Settings",
    navigate: (page) => openProjectOverview(page, "settings"),
  },
  {
    id: "logs",
    name: "Logs & Traces — Logs",
    navigate: (page) => openLmt(page, "logs"),
    waitForReady: async (page) => {
      await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 })
      const blocksTab = page.getByRole("tab", { name: "Managed Service" })
      if (!(await blocksTab.isVisible({ timeout: 15_000 }).catch(() => false))) {
        await page.reload({ waitUntil: "domcontentloaded" }).catch(() => {})
        await expect(page.getByRole("heading").first()).toBeVisible({ timeout: 20_000 })
      }
      await expect(blocksTab).toBeVisible({ timeout: 30_000 })
    },
  },
  {
    id: "tracing",
    name: "Logs & Traces — Tracing",
    navigate: (page) => openLmt(page, "tracing"),
    waitForReady: async (page) => {
      await expect(page.getByRole("heading", { name: "Tracing" })).toBeVisible({
        timeout: 30_000,
      })
    },
  },
  {
    id: "usage",
    name: "Logs & Traces — Usage",
    navigate: (page) => openLmt(page, "usage"),
    waitForReady: async (page) => {
      await expect(page.getByText("Global overview")).toBeVisible({ timeout: 30_000 })
    },
  },
  {
    id: "email-management",
    name: "Email Management",
    navigate: (page) => openEmailManagement(page),
  },
]

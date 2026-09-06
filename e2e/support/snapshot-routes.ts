import { expect, type Page } from "@playwright/test"
import { waitForUsersListSettledFlow } from "../pages/identity-and-access/users"
import { waitForOidcListSettledFlow } from "../pages/secrets-and-configs/oidc"
import {
  openEmailManagement,
  openIam,
  openLmt,
  openOidcTemplate,
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
    waitForReady: async (page) => {
      await expect(page.getByRole("heading", { name: "Users" })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByRole("button", { name: "Filters" })).toBeVisible({
        timeout: 15_000,
      })
      await waitForUsersListSettledFlow(page)
    },
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
    waitForReady: async (page) => {
      await expect(page.getByRole("button", { name: "Add Organization" })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByRole("button", { name: "Configure Organization" })).toBeVisible({
        timeout: 15_000,
      })
    },
  },
  {
    id: "organizations-add-dialog",
    name: "Identity & Access — Organizations · Add dialog",
    navigate: async (page) => {
      await openIam(page, "organization", /^Organizations$/)
      const add = page.getByRole("button", { name: "Add Organization" })
      await expect(add).toBeEnabled({ timeout: 30_000 })
      await add.click()
      await expect(page.getByRole("dialog", { name: "Add Organization" })).toBeVisible({
        timeout: 15_000,
      })
    },
  },
  {
    id: "organizations-add-validation",
    name: "Identity & Access — Organizations · Add max-length validation",
    navigate: async (page) => {
      await openIam(page, "organization", /^Organizations$/)
      const add = page.getByRole("button", { name: "Add Organization" })
      await expect(add).toBeEnabled({ timeout: 30_000 })
      await add.click()
      const dialog = page.getByRole("dialog", { name: "Add Organization" })
      await expect(dialog).toBeVisible({ timeout: 15_000 })
      await dialog.getByRole("textbox", { name: "Name" }).fill("a".repeat(101))
      await dialog.getByRole("button", { name: "Add", exact: true }).click()
      await expect(
        dialog.getByText("Name must be at most 100 characters", { exact: true }),
      ).toBeVisible({ timeout: 10_000 })
    },
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
    waitForReady: async (page) => {
      await waitForOidcListSettledFlow(page)
      await expect(page.getByRole("button", { name: "Manage Template" })).toBeVisible({
        timeout: 30_000,
      })
    },
  },
  {
    id: "oidc-branding",
    name: "Secrets & Configs — OIDC Template (Manage Template)",
    navigate: (page) => openOidcTemplate(page),
    waitForReady: async (page) => {
      await expect(page.getByRole("tablist", { name: "Template sections" })).toBeVisible({
        timeout: 30_000,
      })
      await expect(page.getByRole("heading", { name: "Live preview" })).toBeVisible({
        timeout: 15_000,
      })
    },
  },
  {
    id: "oidc-branding-theme",
    name: "Secrets & Configs — OIDC Template · Theme",
    navigate: async (page) => {
      await openOidcTemplate(page)
      await page.getByRole("tablist", { name: "Template sections" }).getByRole("tab", { name: "Theme" }).click()
      await expect(page.getByRole("heading", { name: "Color system" })).toBeVisible({
        timeout: 15_000,
      })
    },
  },
  {
    id: "oidc-branding-pages",
    name: "Secrets & Configs — OIDC Template · Pages",
    navigate: async (page) => {
      await openOidcTemplate(page)
      await page.getByRole("tablist", { name: "Template sections" }).getByRole("tab", { name: "Pages" }).click()
      await expect(page.getByRole("heading", { name: "Page content" })).toBeVisible({
        timeout: 15_000,
      })
    },
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
      await expect(page.getByText("Total API calls")).toBeVisible({ timeout: 30_000 })
    },
  },
  {
    id: "email-management",
    name: "Email Management",
    navigate: (page) => openEmailManagement(page),
  },
]

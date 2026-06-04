/** Mirrors server `MigrationServiceNames` enum (Identifier.DomainService). */
export enum MigrationServiceId {
  Authentication = 0,
  IAM = 1,
  MFA = 2,
  CAPTCHA = 3,
  Email = 4,
  DataGateway = 5,
  Notifications = 6,
  Storage = 7,
  Language = 8,
}

export type MigrationServiceCatalogItem = {
  id: MigrationServiceId
  label: string
  tags: string[]
  /** Registered service `name` values that mark this migration service as available. */
  registryNames: string[]
}

export const MIGRATION_SERVICE_CATALOG: MigrationServiceCatalogItem[] = [
  {
    id: MigrationServiceId.Email,
    label: "Email",
    tags: ["Templates"],
    registryNames: ["Email", "email"],
  },
  {
    id: MigrationServiceId.DataGateway,
    label: "Data Gateway",
    tags: ["SchemaDefinitions", "DataServiceConfigurations"],
    registryNames: ["DataGateway", "Data Gateway", "data-gateway"],
  },
  {
    id: MigrationServiceId.Language,
    label: "Language",
    tags: ["Key", "Module"],
    registryNames: ["Language", "language"],
  },
  {
    id: MigrationServiceId.Authentication,
    label: "Authentication",
    tags: [],
    registryNames: ["Authentication", "authentication"],
  },
  {
    id: MigrationServiceId.IAM,
    label: "IAM",
    tags: [],
    registryNames: ["IAM", "Iam", "iam"],
  },
]

export const isMigrationServiceRegistered = (
  registryNames: string[],
  registeredServiceNames: string[],
): boolean => {
  const normalized = new Set(
    registeredServiceNames.map((name) => name.trim().toLowerCase()),
  )
  return registryNames.some((name) => normalized.has(name.trim().toLowerCase()))
}

import type { IRole } from "@blocks-idp/iam/models/role"

export const createRoleStub = (
  partial: Pick<IRole, "slug"> & Partial<IRole>,
): IRole => ({
  itemId: partial.itemId ?? partial.slug,
  name: partial.name ?? partial.slug,
  description: partial.description ?? "",
  slug: partial.slug,
  ancestorRoleSlugs: partial.ancestorRoleSlugs ?? [],
  parentRoleSlug: partial.parentRoleSlug ?? null,
  canCreateOwn: partial.canCreateOwn ?? false,
  count: partial.count ?? 0,
  createdFromDefault: partial.createdFromDefault ?? false,
  createdDate: partial.createdDate ?? "",
  lastUpdatedDate: partial.lastUpdatedDate ?? "",
  createdBy: partial.createdBy ?? "",
  language: partial.language ?? null,
  lastUpdatedBy: partial.lastUpdatedBy ?? "",
  organizationId: partial.organizationId ?? "default",
  tags: partial.tags ?? [],
  ...(partial.projectKey !== undefined ? { projectKey: partial.projectKey } : {}),
})

export const toRoleStubs = (slugs: string[]): IRole[] =>
  slugs.map((slug) => createRoleStub({ slug }))

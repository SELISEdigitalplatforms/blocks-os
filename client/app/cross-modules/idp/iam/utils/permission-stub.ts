import { PermissionSeverityLevel, type IPermission } from "@blocks-idp/iam/models/permission";

/**
 * Mirrors `createRoleStub`: a placeholder record for a permission that is referenced
 * by resource but is no longer (or not yet) present in the permission list.
 */
export const createPermissionStub = (
  partial: Pick<IPermission, "resource"> & Partial<IPermission>,
): IPermission => ({
  itemId: partial.itemId ?? partial.resource,
  name: partial.name ?? partial.resource,
  resource: partial.resource,
  type: partial.type ?? 0,
  description: partial.description ?? "",
  resourceGroup: partial.resourceGroup ?? "",
  projectKey: partial.projectKey ?? "",
  tags: partial.tags ?? [],
  roles: partial.roles ?? [],
  dependentPermissions: partial.dependentPermissions ?? [],
  isArchived: partial.isArchived ?? false,
  isBuiltIn: partial.isBuiltIn ?? false,
  language: partial.language ?? null,
  organizationIds: partial.organizationIds ?? [],
  permissionSeverity: partial.permissionSeverity ?? PermissionSeverityLevel.Critical,
});

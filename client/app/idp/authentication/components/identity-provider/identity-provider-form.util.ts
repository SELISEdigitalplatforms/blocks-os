import {
  IPermission,
  PermissionSeverityLevel,
} from "@blocks-idp/iam/models/permission";
import { toRoleStubs } from "@blocks-idp/iam/utils/role-stub"

export { toRoleStubs }

export const toPermissionStub = (resource: string): IPermission => ({
  itemId: resource,
  name: resource,
  type: 1,
  description: "",
  resource,
  resourceGroup: "",
  projectKey: "",
  tags: [],
  roles: [],
  dependentPermissions: [],
  isArchived: false,
  isBuiltIn: false,
  language: null,
  organizationIds: [],
  permissionSeverity: PermissionSeverityLevel.Low,
});

export const toPermissionStubs = (resources: string[]): IPermission[] =>
  resources.map(toPermissionStub);

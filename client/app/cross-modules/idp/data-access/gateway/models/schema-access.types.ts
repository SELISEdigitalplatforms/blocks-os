import type { IDataAccessRuleSet } from "./data-service";

export type FieldAccessTarget = {
  name: string;
  readAccess?: IDataAccessRuleSet;
  writeAccess?: IDataAccessRuleSet;
  deleteAccess?: IDataAccessRuleSet;
};

export type AccessEntry = {
  type: "Role" | "User" | "Permission";
  name: string;
  department?: string;
  roleSlug?: string;
  userId?: string;
  permissionResource?: string;
};

export type PermissionOption = {
  resource: string;
  itemId?: string;
  name: string;
  resourceGroup?: string;
  description?: string;
};


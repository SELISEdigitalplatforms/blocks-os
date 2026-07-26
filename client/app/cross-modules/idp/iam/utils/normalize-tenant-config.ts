import type { IOrganizationConfigResponse } from "@blocks-idp/iam/models/organization-config.model";
import type { IGetSignUpSettingResponse } from "@blocks-idp/iam/models/user";

type TenantConfigApiDict = Record<string, unknown>;

const readBool = (raw: TenantConfigApiDict, ...keys: string[]): boolean => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
  }
  return false;
};

const readBoolWithDefault = (
  raw: TenantConfigApiDict,
  defaultValue: boolean,
  ...keys: string[]
): boolean => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
  }
  return defaultValue;
};

const readString = (raw: TenantConfigApiDict, ...keys: string[]): string => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string") return value;
  }
  return "";
};

const readStringArray = (raw: TenantConfigApiDict, ...keys: string[]): string[] => {
  for (const key of keys) {
    const value = raw[key];
    if (!Array.isArray(value)) continue;
    return value.filter((item): item is string => typeof item === "string");
  }
  return [];
};

export const mapOrganizationConfigFromApi = (
  raw: TenantConfigApiDict,
): IOrganizationConfigResponse => ({
  itemId: readString(raw, "ItemId", "itemId"),
  createdDate: readString(raw, "CreatedDate", "createdDate"),
  lastUpdatedDate: readString(raw, "LastUpdatedDate", "lastUpdatedDate"),
  createdBy: readString(raw, "CreatedBy", "createdBy"),
  language: readString(raw, "Language", "language"),
  lastUpdatedBy: readString(raw, "LastUpdatedBy", "lastUpdatedBy"),
  organizationIds: readStringArray(raw, "OrganizationIds", "organizationIds"),
  tags: readStringArray(raw, "Tags", "tags"),
  allowCreationFromCloud: readBool(
    raw,
    "AllowOrgCreationFromCloud",
    "allowOrgCreationFromCloud",
    "allowCreationFromCloud",
  ),
  allowCreationFromConstruct: readBool(
    raw,
    "AllowOrgCreationFromConstruct",
    "allowOrgCreationFromConstruct",
    "allowCreationFromConstruct",
  ),
  isMultiOrgEnabled: readBool(raw, "IsMultiOrgEnabled", "isMultiOrgEnabled"),
  consentForMultiOrgEnable: readBool(raw, "ConsentForMultiOrgEnable", "consentForMultiOrgEnable"),
  allowOrgCreationFromSignup: readBool(
    raw,
    "AllowOrgCreationFromSignup",
    "allowOrgCreationFromSignup",
  ),
  allowOrgCreationFromPortal: readBool(
    raw,
    "AllowOrgCreationFromPortal",
    "allowOrgCreationFromPortal",
  ),
  defaultRoleOnOrgCreation: readStringArray(
    raw,
    "DefaultRolesOnOrgCreation",
    "defaultRolesOnOrgCreation",
    "DefaultRoleOnOrgCreation",
    "defaultRoleOnOrgCreation",
  ),
  defaultPermissionOnOrgCreation: readStringArray(
    raw,
    "DefaultPermissionsOnOrgCreation",
    "defaultPermissionsOnOrgCreation",
    "DefaultPermissionOnOrgCreation",
    "defaultPermissionOnOrgCreation",
  ),
  keepOrgRolesSameAsDefaultRoles: readBoolWithDefault(
    raw,
    true,
    "KeepOrgRolesSameAsDefaultRoles",
    "keepOrgRolesSameAsDefaultRoles",
  ),
  keepOrgPermissionsSameAsDefaultPermissions: readBoolWithDefault(
    raw,
    true,
    "KeepOrgPermissionsSameAsDefaultPermissions",
    "keepOrgPermissionsSameAsDefaultPermissions",
  ),
});

export const mapSignUpSettingFromApi = (raw: TenantConfigApiDict): IGetSignUpSettingResponse => {
  const isEmailPasswordSignUpEnabled = readBool(
    raw,
    "IsEmailPasswordSignUpEnabled",
    "isEmailPasswordSignUpEnabled",
  );
  const isSSoSignUpEnabled = readBool(raw, "IsSSoSignUpEnabled", "isSSoSignUpEnabled");
  const isSignUpEnable =
    readBool(raw, "IsSignUpEnable", "isSignUpEnable") ||
    isEmailPasswordSignUpEnabled ||
    isSSoSignUpEnabled;

  return {
    itemId: readString(raw, "ItemId", "itemId"),
    createdDate: readString(raw, "CreatedDate", "createdDate"),
    lastUpdatedDate: readString(raw, "LastUpdatedDate", "lastUpdatedDate"),
    createdBy: readString(raw, "CreatedBy", "createdBy"),
    language: readString(raw, "Language", "language"),
    lastUpdatedBy: readString(raw, "LastUpdatedBy", "lastUpdatedBy"),
    organizationIds: readStringArray(raw, "OrganizationIds", "organizationIds"),
    tags: readStringArray(raw, "Tags", "tags"),
    isSignUpEnable,
    isEmailPasswordSignUpEnabled,
    isSSoSignUpEnabled,
    defaultRolesForNewUser: readStringArray(
      raw,
      "DefaultRolesForNewUser",
      "defaultRolesForNewUser",
    ),
    defaultPermissionsForNewUser: readStringArray(
      raw,
      "DefaultPermissionsForNewUser",
      "defaultPermissionsForNewUser",
    ),
  };
};

import { z } from "zod";

export interface IOrganizationConfigResponse {
  itemId: string;
  createdDate: string;
  lastUpdatedDate: string;
  createdBy: string;
  language: string;
  lastUpdatedBy: string;
  organizationIds: string[];
  tags: string[];
  allowCreationFromCloud: boolean;
  allowCreationFromConstruct: boolean;
  isMultiOrgEnabled: boolean;
  allowOrgCreationFromSignup: boolean;
  allowOrgCreationFromPortal: boolean;
  defaultRoleOnOrgCreation: string[];
  defaultPermissionOnOrgCreation: string[];
  keepOrgRolesSameAsDefaultRoles: boolean;
  keepOrgPermissionsSameAsDefaultPermissions: boolean;
  consentForMultiOrgEnable: boolean;
}

export interface IOrganizationConfigSaveApiPayload {
  allowOrgCreationFromCloud: boolean;
  allowOrgCreationFromConstruct: boolean;
  allowOrgCreationFromSignup: boolean;
  allowOrgCreationFromPortal: boolean;
  isMultiOrgEnabled: boolean;
  consentForMultiOrgEnable?: boolean;
  defaultRolesOnOrgCreation: string[];
  defaultPermissionsOnOrgCreation: string[];
  keepOrgRolesSameAsDefaultRoles: boolean;
  keepOrgPermissionsSameAsDefaultPermissions: boolean;
}

/** @deprecated Use IOrganizationConfigSaveApiPayload — kept for IAM module callers during migration */
export interface IOrganizationConfigPayload extends IOrganizationConfigSaveApiPayload {
  itemId?: string;
  projectKey?: string;
  roles?: string[];
  allowCreationFromCloud?: boolean;
  allowCreationFromConstruct?: boolean;
}

export interface IOrganizationConfigSaveResponse {
  errors: unknown;
  isSuccess: boolean;
}

export const organizationConfigFormSchema = z.object({
  isMultiOrgEnabled: z.boolean(),
  allowCreationFromCloud: z.boolean(),
  allowCreationFromConstruct: z.boolean(),
});

export type IOrganizationConfigForm = z.infer<typeof organizationConfigFormSchema>;

export const organizationConfigFormDefaultValues: IOrganizationConfigForm = {
  isMultiOrgEnabled: false,
  allowCreationFromCloud: true,
  allowCreationFromConstruct: false,
};

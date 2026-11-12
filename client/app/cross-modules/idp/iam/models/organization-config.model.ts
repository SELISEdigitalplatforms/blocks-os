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
  isSignupAutoJoinEnabled: boolean;
  signupAutoJoinOrganizationId: string | null;
  /** Lets users whose organizations are all disabled sign in without one. Absent on an older IAM. */
  allowNoOrgSignInForDisabledOrganizations?: boolean;
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
  isSignupAutoJoinEnabled?: boolean;
  signupAutoJoinOrganizationId?: string | null;
  /** Left out unless the caller sets it, so IAM keeps the stored value. */
  allowNoOrgSignInForDisabledOrganizations?: boolean;
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

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const organizationConfigFormDefaultValues: IOrganizationConfigForm = {
//   isMultiOrgEnabled: false,
//   allowCreationFromCloud: true,
//   allowCreationFromConstruct: false,
// };

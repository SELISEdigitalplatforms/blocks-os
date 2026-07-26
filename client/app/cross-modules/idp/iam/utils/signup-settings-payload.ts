import type { ISaveSignUpSettingPayload } from "@blocks-idp/iam/models/user";

export const toSignupSettingsSaveApiPayload = (
  payload: ISaveSignUpSettingPayload,
): Record<string, unknown> => ({
  isSignUpEnable: payload.isSignUpEnable,
  isEmailPasswordSignUpEnabled: payload.isEmailPasswordSignUpEnabled,
  isSSoSignUpEnabled: payload.isSSoSignUpEnabled,
  defaultRolesForNewUserOnSignUp: payload.defaultRolesForNewUserOnSignUp ?? [],
  defaultPermissionsForNewUserOnSignUp: payload.defaultPermissionsForNewUserOnSignUp ?? [],
});

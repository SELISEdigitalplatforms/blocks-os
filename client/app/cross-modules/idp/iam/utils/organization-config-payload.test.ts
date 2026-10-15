import { describe, expect, it } from "vitest";
import { toOrganizationConfigSaveApiPayload } from "./organization-config-payload";

describe("organization-config-payload", () => {
  it("maps save payload to API camelCase body", () => {
    expect(
      toOrganizationConfigSaveApiPayload({
        allowOrgCreationFromCloud: true,
        allowOrgCreationFromConstruct: false,
        allowOrgCreationFromSignup: false,
        allowOrgCreationFromPortal: true,
        isMultiOrgEnabled: true,
        consentForMultiOrgEnable: true,
        defaultRolesOnOrgCreation: ["member"],
        defaultPermissionsOnOrgCreation: ["blocks-idp::read-users"],
        keepOrgRolesSameAsDefaultRoles: false,
        keepOrgPermissionsSameAsDefaultPermissions: true,
      }),
    ).toEqual({
      allowOrgCreationFromCloud: true,
      allowOrgCreationFromConstruct: false,
      allowOrgCreationFromSignup: false,
      allowOrgCreationFromPortal: true,
      isMultiOrgEnabled: true,
      consentForMultiOrgEnable: true,
      defaultRolesOnOrgCreation: ["member"],
      defaultPermissionsOnOrgCreation: ["blocks-idp::read-users"],
      keepOrgRolesSameAsDefaultRoles: false,
      keepOrgPermissionsSameAsDefaultPermissions: true,
      isSignupAutoJoinEnabled: false,
    });
  });

  it("omits consent flag when false", () => {
    expect(
      toOrganizationConfigSaveApiPayload({
        allowOrgCreationFromCloud: false,
        allowOrgCreationFromConstruct: false,
        allowOrgCreationFromSignup: false,
        allowOrgCreationFromPortal: false,
        isMultiOrgEnabled: false,
        consentForMultiOrgEnable: false,
        defaultRolesOnOrgCreation: [],
        defaultPermissionsOnOrgCreation: [],
        keepOrgRolesSameAsDefaultRoles: true,
        keepOrgPermissionsSameAsDefaultPermissions: true,
      }),
    ).not.toHaveProperty("consentForMultiOrgEnable");
  });

  const base = {
    allowOrgCreationFromCloud: false,
    allowOrgCreationFromConstruct: false,
    allowOrgCreationFromSignup: true,
    allowOrgCreationFromPortal: false,
    isMultiOrgEnabled: true,
    consentForMultiOrgEnable: true,
    defaultRolesOnOrgCreation: [],
    defaultPermissionsOnOrgCreation: [],
    keepOrgRolesSameAsDefaultRoles: true,
    keepOrgPermissionsSameAsDefaultPermissions: true,
  };

  it("sends the auto-join flag and target while the toggle is on", () => {
    expect(
      toOrganizationConfigSaveApiPayload({
        ...base,
        isSignupAutoJoinEnabled: true,
        signupAutoJoinOrganizationId: "org-sales",
      }),
    ).toMatchObject({ isSignupAutoJoinEnabled: true, signupAutoJoinOrganizationId: "org-sales" });
  });

  it("omits the target while the toggle is off", () => {
    const body = toOrganizationConfigSaveApiPayload({
      ...base,
      isSignupAutoJoinEnabled: false,
      signupAutoJoinOrganizationId: "org-sales",
    });
    expect(body.isSignupAutoJoinEnabled).toBe(false);
    expect(body).not.toHaveProperty("signupAutoJoinOrganizationId");
  });

  it("sends null when the toggle is on without a target", () => {
    expect(
      toOrganizationConfigSaveApiPayload({ ...base, isSignupAutoJoinEnabled: true }),
    ).toMatchObject({ signupAutoJoinOrganizationId: null });
  });
});

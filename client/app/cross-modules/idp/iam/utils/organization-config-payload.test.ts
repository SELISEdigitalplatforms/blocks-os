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

  it("sends the disabled-organization sign-in flag when the caller sets it", () => {
    expect(
      toOrganizationConfigSaveApiPayload({
        ...base,
        allowNoOrgSignInForDisabledOrganizations: true,
      }),
    ).toMatchObject({ allowNoOrgSignInForDisabledOrganizations: true });
    expect(
      toOrganizationConfigSaveApiPayload({
        ...base,
        allowNoOrgSignInForDisabledOrganizations: false,
      }),
    ).toMatchObject({ allowNoOrgSignInForDisabledOrganizations: false });
  });

  // C9: a caller that does not set it leaves it out, so IAM keeps the stored value.
  it("omits the disabled-organization sign-in flag when the caller leaves it unset", () => {
    expect(toOrganizationConfigSaveApiPayload(base)).not.toHaveProperty(
      "allowNoOrgSignInForDisabledOrganizations",
    );
  });
});

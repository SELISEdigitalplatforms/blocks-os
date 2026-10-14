import { describe, expect, it } from "vitest";
import {
  buildOrganizationConfigSavePayload,
  organizationConfigFormSchema,
  toOrganizationConfigFormValues,
} from "./organization-config-form";
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model";

const baseConfig: ISettingsOrganizationConfig = {
  itemId: "org-1",
  allowCreationFromCloud: true,
  allowCreationFromConstruct: false,
  allowOrgCreationFromSignup: false,
  allowOrgCreationFromPortal: true,
  isMultiOrgEnabled: false,
  consentForMultiOrgEnable: false,
  defaultRolesOnOrgCreation: ["member"],
  defaultPermissionsOnOrgCreation: ["blocks-idp::read-users"],
  keepOrgRolesSameAsDefaultRoles: true,
  keepOrgPermissionsSameAsDefaultPermissions: false,
  isSignupAutoJoinEnabled: false,
  signupAutoJoinOrganizationId: null,
};

describe("organization-config-form", () => {
  it("maps settings config into form values", () => {
    expect(toOrganizationConfigFormValues(baseConfig)).toEqual({
      allowOrgCreationFromCloud: true,
      allowOrgCreationFromConstruct: false,
      allowOrgCreationFromSignup: false,
      allowOrgCreationFromPortal: true,
      isMultiOrgEnabled: false,
      isSignupAutoJoinEnabled: false,
      signupAutoJoinOrganizationId: "",
    });
  });

  it("preserves server multi-org flags on save", () => {
    const config = { ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true };
    const values = toOrganizationConfigFormValues(config);

    const payload = buildOrganizationConfigSavePayload(config, values);

    expect(payload).toEqual({
      allowOrgCreationFromCloud: true,
      allowOrgCreationFromConstruct: false,
      allowOrgCreationFromSignup: false,
      allowOrgCreationFromPortal: true,
      isMultiOrgEnabled: true,
      consentForMultiOrgEnable: true,
      defaultRolesOnOrgCreation: ["member"],
      defaultPermissionsOnOrgCreation: ["blocks-idp::read-users"],
      keepOrgRolesSameAsDefaultRoles: true,
      keepOrgPermissionsSameAsDefaultPermissions: false,
      isSignupAutoJoinEnabled: false,
    });
  });

  it("enables multi-org and grants consent from the pending form value", () => {
    const values = {
      ...toOrganizationConfigFormValues(baseConfig),
      isMultiOrgEnabled: true,
    };

    const payload = buildOrganizationConfigSavePayload(baseConfig, values);

    expect(payload.isMultiOrgEnabled).toBe(true);
    expect(payload.consentForMultiOrgEnable).toBe(true);
  });

  it("sends creation workflow edits made in the same unsaved batch as the enable", () => {
    const values = {
      ...toOrganizationConfigFormValues(baseConfig),
      isMultiOrgEnabled: true,
      allowOrgCreationFromSignup: true,
      allowOrgCreationFromCloud: false,
    };

    const payload = buildOrganizationConfigSavePayload(baseConfig, values);

    expect(payload.allowOrgCreationFromSignup).toBe(true);
    expect(payload.allowOrgCreationFromCloud).toBe(false);
    expect(payload.isMultiOrgEnabled).toBe(true);
  });

  it("does not enable multi-org while the toggle is left off", () => {
    const values = toOrganizationConfigFormValues(baseConfig);

    const payload = buildOrganizationConfigSavePayload(baseConfig, values);

    expect(payload.isMultiOrgEnabled).toBe(false);
    expect(payload.consentForMultiOrgEnable).toBe(false);
  });

  it("maps stored auto-join values into the form", () => {
    const values = toOrganizationConfigFormValues({
      ...baseConfig,
      isSignupAutoJoinEnabled: true,
      signupAutoJoinOrganizationId: "org-sales",
    });
    expect(values.isSignupAutoJoinEnabled).toBe(true);
    expect(values.signupAutoJoinOrganizationId).toBe("org-sales");
  });

  it("sends the auto-join target only while the toggle is on", () => {
    const on = buildOrganizationConfigSavePayload(baseConfig, {
      ...toOrganizationConfigFormValues(baseConfig),
      isMultiOrgEnabled: true,
      isSignupAutoJoinEnabled: true,
      signupAutoJoinOrganizationId: "org-sales",
    });
    expect(on.isSignupAutoJoinEnabled).toBe(true);
    expect(on.signupAutoJoinOrganizationId).toBe("org-sales");

    const off = buildOrganizationConfigSavePayload(baseConfig, {
      ...toOrganizationConfigFormValues(baseConfig),
      isSignupAutoJoinEnabled: false,
      signupAutoJoinOrganizationId: "org-sales",
    });
    expect(off.isSignupAutoJoinEnabled).toBe(false);
    expect(off).not.toHaveProperty("signupAutoJoinOrganizationId");
  });

  it("requires an organization when auto-join is on with multi-org", () => {
    const values = {
      ...toOrganizationConfigFormValues(baseConfig),
      isMultiOrgEnabled: true,
      isSignupAutoJoinEnabled: true,
      signupAutoJoinOrganizationId: "  ",
    };
    const result = organizationConfigFormSchema.safeParse(values);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["signupAutoJoinOrganizationId"],
      message: "Choose the organization new sign-ups join.",
    });

    expect(
      organizationConfigFormSchema.safeParse({ ...values, isMultiOrgEnabled: false }).success,
    ).toBe(true);
    expect(
      organizationConfigFormSchema.safeParse({ ...values, signupAutoJoinOrganizationId: "default" })
        .success,
    ).toBe(true);
  });
});

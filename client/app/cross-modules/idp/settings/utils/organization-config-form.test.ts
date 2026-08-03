import { describe, expect, it } from "vitest";
import {
  buildOrganizationConfigSavePayload,
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
};

describe("organization-config-form", () => {
  it("maps settings config into form values", () => {
    expect(toOrganizationConfigFormValues(baseConfig)).toEqual({
      allowOrgCreationFromCloud: true,
      allowOrgCreationFromConstruct: false,
      allowOrgCreationFromSignup: false,
      allowOrgCreationFromPortal: true,
      isMultiOrgEnabled: false,
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
});

import { describe, expect, it } from "vitest"
import {
  buildEnableMultiOrgPayload,
  buildOrganizationConfigSavePayload,
  toOrganizationConfigFormValues,
} from "./organization-config-form"
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model"

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
}

describe("buildEnableMultiOrgPayload", () => {
  it("enables multi-org, bumps consent when false, keeps creation fields", () => {
    const payload = buildEnableMultiOrgPayload(baseConfig)

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
    })
  })

  it("keeps consent true when already true", () => {
    const payload = buildEnableMultiOrgPayload({
      ...baseConfig,
      consentForMultiOrgEnable: true,
    })

    expect(payload.consentForMultiOrgEnable).toBe(true)
  })
})

describe("organization-config-form", () => {
  it("maps settings config into form values", () => {
    expect(toOrganizationConfigFormValues(baseConfig)).toEqual({
      allowOrgCreationFromCloud: true,
      allowOrgCreationFromConstruct: false,
      allowOrgCreationFromSignup: false,
      allowOrgCreationFromPortal: true,
    })
  })

  it("preserves server multi-org flags on save", () => {
    const config = { ...baseConfig, isMultiOrgEnabled: true, consentForMultiOrgEnable: true }
    const values = toOrganizationConfigFormValues(config)

    const payload = buildOrganizationConfigSavePayload(config, values)

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
    })
  })
})

import { describe, expect, it } from "vitest"
import { toOrganizationConfigSaveApiPayload } from "./organization-config-payload"

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
    })
  })

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
    ).not.toHaveProperty("consentForMultiOrgEnable")
  })
})

import { describe, expect, it } from "vitest"
import {
  mapOrganizationConfigFromApi,
  mapSignUpSettingFromApi,
} from "@blocks-idp/iam/utils/normalize-tenant-config"

describe("normalize-tenant-config", () => {
  it("maps organization config from PascalCase API keys", () => {
    expect(
      mapOrganizationConfigFromApi({
        ItemId: "org-1",
        AllowOrgCreationFromCloud: true,
        AllowOrgCreationFromConstruct: false,
        AllowOrgCreationFromSignup: true,
        AllowOrgCreationFromPortal: false,
        IsMultiOrgEnabled: true,
        DefaultRoleOnOrgCreation: ["member"],
        DefaultPermissionOnOrgCreation: ["read"],
      }),
    ).toMatchObject({
      itemId: "org-1",
      allowCreationFromCloud: true,
      allowCreationFromConstruct: false,
      allowOrgCreationFromSignup: true,
      allowOrgCreationFromPortal: false,
      isMultiOrgEnabled: true,
      defaultRoleOnOrgCreation: ["member"],
      defaultPermissionOnOrgCreation: ["read"],
    })
  })

  it("maps organization config from camelCase API keys", () => {
    expect(
      mapOrganizationConfigFromApi({
        itemId: "org-1",
        allowOrgCreationFromCloud: true,
        allowOrgCreationFromConstruct: false,
        allowOrgCreationFromSignup: true,
        allowOrgCreationFromPortal: false,
        isMultiOrgEnabled: true,
        defaultRoleOnOrgCreation: ["member"],
        defaultPermissionOnOrgCreation: ["read"],
      }),
    ).toMatchObject({
      itemId: "org-1",
      allowCreationFromCloud: true,
      allowCreationFromConstruct: false,
      allowOrgCreationFromSignup: true,
      allowOrgCreationFromPortal: false,
      isMultiOrgEnabled: true,
      defaultRoleOnOrgCreation: ["member"],
      defaultPermissionOnOrgCreation: ["read"],
    })
  })

  it("maps signup settings from camelCase API keys", () => {
    expect(
      mapSignUpSettingFromApi({
        isSignUpEnable: true,
        isEmailPasswordSignUpEnabled: true,
        isSSoSignUpEnabled: false,
        defaultRolesForNewUser: ["user"],
        defaultPermissionsForNewUser: ["view"],
      }),
    ).toMatchObject({
      itemId: "",
      isSignUpEnable: true,
      isEmailPasswordSignUpEnabled: true,
      isSSoSignUpEnabled: false,
      defaultRolesForNewUser: ["user"],
      defaultPermissionsForNewUser: ["view"],
    })
  })

  it("computes isSignUpEnable when omitted from API response", () => {
    expect(
      mapSignUpSettingFromApi({
        isEmailPasswordSignUpEnabled: false,
        isSSoSignUpEnabled: true,
        defaultRolesForNewUser: [],
        defaultPermissionsForNewUser: [],
      }).isSignUpEnable,
    ).toBe(true)
  })
})

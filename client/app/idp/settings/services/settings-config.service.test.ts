import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { authenticationService } from "@blocks-idp/authentication/services/authentication.service"
import { organizationService } from "@blocks-idp/iam/services/organization.service"
import { userService } from "@blocks-idp/iam/services/user.service"
import { settingsConfigService } from "./settings-config.service"

vi.mock("@blocks-idp/authentication/services/authentication.service", () => ({
  authenticationService: {
    configuration: {
      getConfig: vi.fn(),
      saveAuthConfig: vi.fn(),
    },
  },
}))

vi.mock("@blocks-idp/iam/services/organization.service", () => ({
  organizationService: {
    getOrganizationConfig: vi.fn(),
    saveOrganizationConfig: vi.fn(),
  },
}))

vi.mock("@blocks-idp/iam/services/user.service", () => ({
  userService: {
    getSignUpSetting: vi.fn(),
    saveSignUpSetting: vi.fn(),
  },
}))

const projectKey = "test-tenant-id"

describe("SettingsConfigService", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe("getAuthConfig", () => {
    it("delegates to authentication configuration service", async () => {
      vi.mocked(authenticationService.configuration.getConfig).mockResolvedValue({
        itemId: "auth-1",
        allowedGrantTypes: ["password"],
        accessTokenValidForNumberMinutes: 7,
        refreshTokenValidForNumberMinutes: 30,
        rememberMeRefreshTokenValidForNumberMinutes: 43200,
        getNumberOfWrongAttemptsToLockTheAccount: 5,
        accountLockDurationInMinutes: 5,
        publicCertificatePath: "/certs/public.pem",
        isSelfSignUpAllowed: false,
        absoluteRefreshTokenValidForNumberMinutes: 10080,
        accountActivationPath: "/activate",
        accountVerificationPath: "/verify",
        recoverAccountPath: "/recover",
        isOidcEnabled: true,
        accountActionBaseUrl: "https://app.blocks.com",
        useAccountActionBaseUrlAsDefault: true,
        activationUrlLifetimeInMinutes: 1440,
        recoverAccountUrlLifetimeInMinutes: 10,
        logoutOnPasswordChange: true,
        passwordStrengthCheckerRegex: ".*",
      })

      const result = await settingsConfigService.getAuthConfig()

      expect(authenticationService.configuration.getConfig).toHaveBeenCalledWith()
      expect(result.itemId).toBe("auth-1")
      expect(result.allowedGrantTypes).toEqual(["password"])
      expect(result.accessTokenValidForNumberMinutes).toBe(7)
    })
  })

  describe("saveAuthConfig", () => {
    it("delegates to authentication configuration save", async () => {
      vi.mocked(authenticationService.configuration.saveAuthConfig).mockResolvedValue({
        isSuccess: true,
        errors: null,
      })

      const payload = {
        itemId: "auth-1",
        refreshTokenValidForNumberMinutes: 30,
        absoluteRefreshTokenValidForNumberMinutes: 10080,
        accessTokenValidForNumberMinutes: 7,
        rememberMeRefreshTokenValidForNumberMinutes: 43200,
        getNumberOfWrongAttemptsToLockTheAccount: 5,
        accountLockDurationInMinutes: 5,
        publicCertificatePath: "/certs/public.pem",
        accountActivationPath: "/activate",
        accountVerificationPath: "/verify",
        recoverAccountPath: "/recover",
        isOidcEnabled: false,
        accountActionBaseUrl: "https://app.blocks.com",
        useAccountActionBaseUrlAsDefault: true,
        activationUrlLifetimeInMinutes: 1440,
        recoverAccountUrlLifetimeInMinutes: 10,
        logoutOnPasswordChange: true,
        passwordStrengthCheckerRegex: ".*",
        allowedGrantTypes: ["password"],
      }

      const result = await settingsConfigService.saveAuthConfig(payload)

      expect(authenticationService.configuration.saveAuthConfig).toHaveBeenCalledWith({
        ...payload,
        projectKey: "",
        isSelfSignUpAllowed: false,
      })
      expect(result.isSuccess).toBe(true)
    })
  })

  describe("getOrganizationConfig", () => {
    it("maps organization config from IAM service", async () => {
      vi.mocked(organizationService.getOrganizationConfig).mockResolvedValue({
        itemId: "org-1",
        createdDate: "",
        lastUpdatedDate: "",
        createdBy: "",
        language: "",
        lastUpdatedBy: "",
        organizationIds: [],
        tags: [],
        allowCreationFromCloud: true,
        allowCreationFromConstruct: false,
        isMultiOrgEnabled: false,
        allowOrgCreationFromSignup: false,
        allowOrgCreationFromPortal: true,
        consentForMultiOrgEnable: false,
        defaultRoleOnOrgCreation: [],
        defaultPermissionOnOrgCreation: [],
        keepOrgRolesSameAsDefaultRoles: true,
        keepOrgPermissionsSameAsDefaultPermissions: true,
      })

      const result = await settingsConfigService.getOrganizationConfig()

      expect(organizationService.getOrganizationConfig).toHaveBeenCalledWith()
      expect(result.allowCreationFromCloud).toBe(true)
      expect(result.allowOrgCreationFromPortal).toBe(true)
      expect(result.isMultiOrgEnabled).toBe(false)
      expect(result.consentForMultiOrgEnable).toBe(false)
      expect(result.defaultRolesOnOrgCreation).toEqual([])
      expect(result.keepOrgPermissionsSameAsDefaultPermissions).toBe(true)
    })

    it("throws when organization config is missing", async () => {
      vi.mocked(organizationService.getOrganizationConfig).mockResolvedValue(null)

      await expect(settingsConfigService.getOrganizationConfig()).rejects.toThrow(
        "Organization config not found",
      )
    })
  })

  describe("saveOrganizationConfig", () => {
    it("delegates to organization service save", async () => {
      vi.mocked(organizationService.saveOrganizationConfig).mockResolvedValue({
        isSuccess: true,
        errors: null,
      })

      const payload = {
        allowOrgCreationFromCloud: true,
        allowOrgCreationFromConstruct: false,
        allowOrgCreationFromSignup: false,
        allowOrgCreationFromPortal: true,
        isMultiOrgEnabled: true,
        consentForMultiOrgEnable: true,
        defaultRolesOnOrgCreation: [],
        defaultPermissionsOnOrgCreation: [],
        keepOrgRolesSameAsDefaultRoles: true,
        keepOrgPermissionsSameAsDefaultPermissions: true,
      }

      const result = await settingsConfigService.saveOrganizationConfig(payload)

      expect(organizationService.saveOrganizationConfig).toHaveBeenCalledWith(payload)
      expect(result.isSuccess).toBe(true)
    })
  })

  describe("getSignUpSetting", () => {
    it("maps signup settings from IAM user service", async () => {
      vi.mocked(userService.getSignUpSetting).mockResolvedValue({
        itemId: "",
        createdDate: "",
        lastUpdatedDate: "",
        createdBy: "",
        language: "",
        lastUpdatedBy: "",
        organizationIds: [],
        tags: [],
        isSignUpEnable: true,
        isEmailPasswordSignUpEnabled: true,
        isSSoSignUpEnabled: false,
        defaultRolesForNewUser: ["user"],
        defaultPermissionsForNewUser: ["blocks-idp::self-service"],
      })

      const result = await settingsConfigService.getSignUpSetting()

      expect(userService.getSignUpSetting).toHaveBeenCalledWith()
      expect(result.isSignUpEnable).toBe(true)
      expect(result.defaultRolesForNewUser).toEqual(["user"])
      expect(result.defaultPermissionsForNewUser).toEqual(["blocks-idp::self-service"])
    })
  })

  describe("saveSignUpSetting", () => {
    it("delegates to user service save", async () => {
      vi.mocked(userService.saveSignUpSetting).mockResolvedValue({
        isSuccess: true,
        itemId: "tenant-config-001",
        errors: null,
      })

      const payload = {
        isSignUpEnable: true,
        isEmailPasswordSignUpEnabled: true,
        isSSoSignUpEnabled: false,
        defaultRolesForNewUserOnSignUp: ["user"],
        defaultPermissionsForNewUserOnSignUp: ["blocks-idp::self-service"],
      }

      const result = await settingsConfigService.saveSignUpSetting(payload)

      expect(userService.saveSignUpSetting).toHaveBeenCalledWith(payload)
      expect(result.isSuccess).toBe(true)
    })
  })
})

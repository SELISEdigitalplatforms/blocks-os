import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { authenticationService } from "@blocks-idp/authentication/services/authentication.service"
import { organizationService } from "@blocks-idp/iam/services/organization.service"
import { userService } from "@blocks-idp/iam/services/user.service"
import { settingsConfigService } from "./settings-config.service"

vi.mock("@blocks-idp/authentication/services/authentication.service", () => ({
  authenticationService: {
    configuration: {
      getConfig: vi.fn(),
    },
  },
}))

vi.mock("@blocks-idp/iam/services/organization.service", () => ({
  organizationService: {
    getOrganizationConfig: vi.fn(),
  },
}))

vi.mock("@blocks-idp/iam/services/user.service", () => ({
  userService: {
    getSignUpSetting: vi.fn(),
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

      const result = await settingsConfigService.getAuthConfig(projectKey)

      expect(authenticationService.configuration.getConfig).toHaveBeenCalledWith({ projectKey })
      expect(result.itemId).toBe("auth-1")
      expect(result.allowedGrantTypes).toEqual(["password"])
    })

    it("rejects when projectKey is missing", async () => {
      await expect(settingsConfigService.getAuthConfig("")).rejects.toThrow(
        "projectKey is required",
      )
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
        defaultRoleOnOrgCreation: ["member"],
        defaultPermissionOnOrgCreation: [],
      })

      const result = await settingsConfigService.getOrganizationConfig(projectKey)

      expect(organizationService.getOrganizationConfig).toHaveBeenCalledWith(projectKey)
      expect(result.allowCreationFromCloud).toBe(true)
      expect(result.allowOrgCreationFromPortal).toBe(true)
    })

    it("throws when organization config is missing", async () => {
      vi.mocked(organizationService.getOrganizationConfig).mockResolvedValue(null)

      await expect(settingsConfigService.getOrganizationConfig(projectKey)).rejects.toThrow(
        "Organization config not found",
      )
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
        defaultPermissionsForNewUser: [],
      })

      const result = await settingsConfigService.getSignUpSetting(projectKey)

      expect(userService.getSignUpSetting).toHaveBeenCalledWith({ projectKey })
      expect(result.isSignUpEnable).toBe(true)
      expect(result.defaultRolesForNewUser).toEqual(["user"])
    })
  })
})

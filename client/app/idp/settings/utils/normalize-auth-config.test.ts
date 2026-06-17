import { GRANT_TYPES } from "@blocks-idp/authentication/constants/authentication.constant"
import {
  canonicalizeGrantType,
  canonicalizeGrantTypes,
  isGrantTypeSelected,
} from "@blocks-idp/authentication/utils/grant-types.util"
import { describe, expect, it } from "vitest"
import { normalizeAuthConfigResponse } from "./normalize-auth-config"

describe("normalizeAuthConfigResponse", () => {
  it("coalesces null API values to display-safe defaults", () => {
    const result = normalizeAuthConfigResponse({
      itemId: null as unknown as string,
      refreshTokenValidForNumberMinutes: null as unknown as number,
      absoluteRefreshTokenValidForNumberMinutes: null as unknown as number,
      accessTokenValidForNumberMinutes: null as unknown as number,
      rememberMeRefreshTokenValidForNumberMinutes: null as unknown as number,
      allowedGrantTypes: null as unknown as string[],
      getNumberOfWrongAttemptsToLockTheAccount: null as unknown as number,
      accountLockDurationInMinutes: null as unknown as number,
      publicCertificatePath:
        "https://blocksdev.blob.core.windows.net/***REMOVED***/cert.pfx",
      accountActivationPath: null as unknown as string,
      accountVerificationPath: null as unknown as string,
      recoverAccountPath: null as unknown as string,
      isOidcEnabled: null as unknown as boolean,
      accountActionBaseUrl: null as unknown as string,
      useAccountActionBaseUrlAsDefault: null as unknown as boolean,
      activationUrlLifetimeInMinutes: null as unknown as number,
      recoverAccountUrlLifetimeInMinutes: null as unknown as number,
      logoutOnPasswordChange: null as unknown as boolean,
      passwordStrengthCheckerRegex: null as unknown as string,
      isSelfSignUpAllowed: false,
    })

    expect(result.accessTokenValidForNumberMinutes).toBe(0)
    expect(result.refreshTokenValidForNumberMinutes).toBe(0)
    expect(result.allowedGrantTypes).toEqual([])
    expect(result.publicCertificatePath).toContain("blocksdev.blob.core.windows.net")
    expect(result.useAccountActionBaseUrlAsDefault).toBe(true)
    expect(result.logoutOnPasswordChange).toBe(true)
  })

  it("reads PascalCase AllowedGrantTypes and canonicalizes client credential aliases", () => {
    const result = normalizeAuthConfigResponse({
      ItemId: "auth-1",
      AllowedGrantTypes: ["authorization_code", "client_credentials"],
      PublicCertificatePath: "https://example.com/cert.pfx",
    })

    expect(result.itemId).toBe("auth-1")
    expect(result.allowedGrantTypes).toEqual([
      GRANT_TYPES.authorizationCode,
      GRANT_TYPES.clientCredential,
    ])
    expect(result.publicCertificatePath).toBe("https://example.com/cert.pfx")
  })
})

describe("grant type helpers", () => {
  it("maps legacy client_credential to client_credentials", () => {
    expect(canonicalizeGrantType("client_credential")).toBe(GRANT_TYPES.clientCredential)
    expect(canonicalizeGrantTypes(["client_credential", "password"])).toEqual([
      GRANT_TYPES.clientCredential,
      GRANT_TYPES.password,
    ])
  })

  it("matches selected grant types across aliases", () => {
    expect(
      isGrantTypeSelected(["client_credentials", "authorization_code"], GRANT_TYPES.clientCredential),
    ).toBe(true)
    expect(isGrantTypeSelected(["client_credential"], GRANT_TYPES.clientCredential)).toBe(true)
    expect(isGrantTypeSelected(["password"], GRANT_TYPES.clientCredential)).toBe(false)
  })
})

import { GRANT_TYPES } from "@blocks-idp/authentication/constants/authentication.constant"
import {
  canonicalizeGrantType,
  canonicalizeGrantTypes,
  isGrantTypeSelected,
} from "./grant-types.util"
import { describe, expect, it } from "vitest"

describe("grant-types.util", () => {
  it("uses OAuth client_credentials as the canonical client credential value", () => {
    expect(GRANT_TYPES.clientCredential).toBe("client_credentials")
    expect(canonicalizeGrantType("client_credential")).toBe("client_credentials")
  })

  it("preserves other grant type values", () => {
    expect(canonicalizeGrantTypes(["authorization_code", "password", "social"])).toEqual([
      "authorization_code",
      "password",
      "social",
    ])
  })

  it("detects selected grant types with alias support", () => {
    expect(isGrantTypeSelected(["authorization_code"], GRANT_TYPES.authorizationCode)).toBe(true)
    expect(isGrantTypeSelected(undefined, GRANT_TYPES.password)).toBe(false)
  })
})

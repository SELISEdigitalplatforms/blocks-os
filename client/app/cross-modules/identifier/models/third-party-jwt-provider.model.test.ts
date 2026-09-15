import { describe, expect, it } from "vitest";
import {
  isSymmetric,
  JwtSigningAlgorithm,
  requiresIdpHeader,
  type ThirdPartyJwtProvider,
} from "./third-party-jwt-provider.model";

const AUTH0 = "https://dev-kqgrj13jhskombl1.us.auth0.com/";
const OKTA = "https://x.okta.com";

const provider = (
  overrides: Partial<ThirdPartyJwtProvider> & Pick<ThirdPartyJwtProvider, "itemId">,
): ThirdPartyJwtProvider => ({
  key: "auth0-a",
  providerName: "Auth0",
  isActive: true,
  issuer: AUTH0,
  audiences: ["api-a"],
  algorithms: [JwtSigningAlgorithm.RS256],
  jwksUrl: "https://example.com/.well-known/jwks.json",
  cookieKey: "",
  hasSigningSecret: false,
  claimsMapping: { userId: "sub", email: "email", userName: "email", name: "name", roles: "" },
  ...overrides,
});

describe("requiresIdpHeader", () => {
  it("is not required when the issuer is unique", () => {
    const a = provider({ itemId: "1" });
    const b = provider({ itemId: "2", issuer: OKTA, key: "okta" });

    expect(requiresIdpHeader(a, [a, b])).toBe(false);
  });

  it("is not required when a shared issuer is separated by audience", () => {
    // The configuration the UI nudges toward: one Auth0 tenant, two apps, distinct audiences.
    const a = provider({ itemId: "1", audiences: ["api-a"] });
    const b = provider({ itemId: "2", key: "auth0-b", audiences: ["api-b"] });

    expect(requiresIdpHeader(a, [a, b])).toBe(false);
    expect(requiresIdpHeader(b, [a, b])).toBe(false);
  });

  it("is required when issuer and audience are both shared", () => {
    const a = provider({ itemId: "1", audiences: ["api-a"] });
    const b = provider({ itemId: "2", key: "auth0-b", audiences: ["api-a"] });

    expect(requiresIdpHeader(a, [a, b])).toBe(true);
    expect(requiresIdpHeader(b, [a, b])).toBe(true);
  });

  it("treats an empty audience list as overlapping everything", () => {
    // An empty list turns audience validation off, so this provider collapses into the same
    // candidate set as every other one from its issuer — the hazard the banner warns about.
    const scoped = provider({ itemId: "1", audiences: ["api-a"] });
    const wideOpen = provider({ itemId: "2", key: "auth0-b", audiences: [] });

    expect(requiresIdpHeader(scoped, [scoped, wideOpen])).toBe(true);
  });

  it("ignores inactive providers", () => {
    const a = provider({ itemId: "1", audiences: ["api-a"] });
    const disabled = provider({ itemId: "2", key: "auth0-b", audiences: ["api-a"], isActive: false });

    expect(requiresIdpHeader(a, [a, disabled])).toBe(false);
  });

  it("does not compare a provider with itself", () => {
    const only = provider({ itemId: "1" });

    expect(requiresIdpHeader(only, [only])).toBe(false);
  });
});

describe("isSymmetric", () => {
  it("identifies the HMAC family", () => {
    expect(isSymmetric(JwtSigningAlgorithm.HS256)).toBe(true);
    expect(isSymmetric(JwtSigningAlgorithm.HS512)).toBe(true);
    expect(isSymmetric(JwtSigningAlgorithm.RS256)).toBe(false);
    expect(isSymmetric(JwtSigningAlgorithm.ES256)).toBe(false);
  });
});

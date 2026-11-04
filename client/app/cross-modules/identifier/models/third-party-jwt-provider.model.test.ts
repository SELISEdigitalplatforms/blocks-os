import { describe, expect, it } from "vitest";
import {
  canCarryPassphrase,
  certificateExpiry,
  certificateExtension,
  keySourceLabel,
  isCertificateFile,
  isSymmetric,
  JwtSigningAlgorithm,
  keySourceOf,
  requiresIdpHeader,
  toSavePayload,
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
  publicCertificatePath: "",
  certificateSubject: "",
  certificateThumbprint: "",
  certificateNotAfter: null,
  cookieKey: "",
  hasSigningSecret: false,
  hasCertificatePassword: false,
  claimsMapping: { userId: "sub", email: "email", userName: "email", name: "name", roles: "" },
  ...overrides,
});

const CERTIFICATE_PATH = "https://cdn.example.com/certificates/tenant-1_3rdparty_1.pfx";

describe("keySourceOf", () => {
  it("reads a certificate provider off its stored path", () => {
    expect(
      keySourceOf(provider({ itemId: "1", jwksUrl: "", publicCertificatePath: CERTIFICATE_PATH })),
    ).toBe("certificate");
  });

  it("reads a JWKS provider", () => {
    expect(keySourceOf(provider({ itemId: "1" }))).toBe("jwks");
  });

  it("treats a provider with neither as a JWKS one", () => {
    // An HMAC provider, or a row that predates this choice. The form then asks for a JWKS URL,
    // which is the answer for every provider that publishes one.
    expect(keySourceOf(provider({ itemId: "1", jwksUrl: "", publicCertificatePath: "" }))).toBe(
      "jwks",
    );
  });
});

describe("isCertificateFile", () => {
  it.each([".crt", ".pem", ".der", ".pfx", ".p12"])("accepts %s", (extension) => {
    expect(isCertificateFile(`provider${extension}`)).toBe(true);
  });

  it("ignores case, because an extension is not case sensitive on any platform here", () => {
    expect(isCertificateFile("PROVIDER.PFX")).toBe(true);
  });

  it("rejects anything else", () => {
    // .key above all: a provider only ever hands over the public half, and accepting a private
    // key would invite someone to upload one into blob storage.
    expect(isCertificateFile("provider.key")).toBe(false);
    expect(isCertificateFile("jwks.json")).toBe(false);
    expect(isCertificateFile("provider")).toBe(false);
  });
});

describe("canCarryPassphrase", () => {
  it("is true only for the PKCS#12 containers", () => {
    expect(canCarryPassphrase("provider.pfx")).toBe(true);
    expect(canCarryPassphrase("provider.p12")).toBe(true);
  });

  it("is false for a bare certificate, which holds only a public key", () => {
    expect(canCarryPassphrase("provider.crt")).toBe(false);
    expect(canCarryPassphrase("provider.pem")).toBe(false);
    expect(canCarryPassphrase("provider.der")).toBe(false);
  });
});

describe("toSavePayload", () => {
  it("sends the certificate and not the JWKS URL for a certificate provider", () => {
    // The server refuses a payload carrying both key sources, so a partial build that leaked the
    // other one would fail every save of an otherwise valid provider.
    const payload = toSavePayload(
      provider({ itemId: "1", jwksUrl: "", publicCertificatePath: CERTIFICATE_PATH }),
    );

    expect(payload.publicCertificatePath).toBe(CERTIFICATE_PATH);
    expect(payload.jwksUrl).toBeUndefined();
  });

  it("sends the JWKS URL and no certificate for a JWKS provider", () => {
    const payload = toSavePayload(provider({ itemId: "1" }));

    expect(payload.jwksUrl).toBe("https://example.com/.well-known/jwks.json");
    expect(payload.publicCertificatePath).toBeUndefined();
  });

  it("sends neither key source for an HMAC provider", () => {
    const payload = toSavePayload(
      provider({
        itemId: "1",
        algorithms: [JwtSigningAlgorithm.HS256],
        jwksUrl: "",
        hasSigningSecret: true,
      }),
    );

    expect(payload.jwksUrl).toBeUndefined();
    expect(payload.publicCertificatePath).toBeUndefined();
  });

  it("never carries a secret or a passphrase, so a partial save cannot clear one", () => {
    const payload = toSavePayload(
      provider({
        itemId: "1",
        jwksUrl: "",
        publicCertificatePath: CERTIFICATE_PATH,
        hasCertificatePassword: true,
      }),
    );

    expect(payload.signingSecret).toBeUndefined();
    expect(payload.publicCertificatePassword).toBeUndefined();
    expect(payload.clearCertificatePassword).toBeUndefined();
  });
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
    const disabled = provider({
      itemId: "2",
      key: "auth0-b",
      audiences: ["api-a"],
      isActive: false,
    });

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

describe("keySourceLabel", () => {
  it("names a certificate provider instead of falling through to an em dash", () => {
    // The regression this exists for: the list card read `jwksUrl || "—"`, so a working
    // certificate-backed provider rendered as though nothing were configured.
    const label = keySourceLabel(
      provider({ itemId: "1", jwksUrl: "", publicCertificatePath: CERTIFICATE_PATH }),
    );

    expect(label).toBe("Certificate (.pfx)");
    expect(label).not.toContain("—");
  });

  it("says when a passphrase is stored", () => {
    expect(
      keySourceLabel(
        provider({
          itemId: "1",
          jwksUrl: "",
          publicCertificatePath: CERTIFICATE_PATH,
          hasCertificatePassword: true,
        }),
      ),
    ).toBe("Certificate (.pfx) — passphrase stored");
  });

  it("copes with a blob URL that carries no extension", () => {
    expect(
      keySourceLabel(
        provider({
          itemId: "1",
          jwksUrl: "",
          publicCertificatePath: "https://cdn.example.com/certificates/tenant-1_3rdparty",
        }),
      ),
    ).toBe("Certificate");
  });

  it("prefers the shared secret, which excludes the other two", () => {
    expect(keySourceLabel(provider({ itemId: "1", jwksUrl: "", hasSigningSecret: true }))).toBe(
      "Shared secret (stored encrypted)",
    );
  });

  it("shows a JWKS URL in full, because it is the provider's own endpoint", () => {
    expect(keySourceLabel(provider({ itemId: "1" }))).toBe(
      "https://example.com/.well-known/jwks.json",
    );
  });

  it("falls back to an em dash only when there is genuinely no key source", () => {
    expect(keySourceLabel(provider({ itemId: "1", jwksUrl: "" }))).toBe("—");
  });
});

describe("certificateExtension", () => {
  it("reads the extension off a blob URL", () => {
    expect(certificateExtension("https://x/y/tenant_3rdparty_p1.CRT")).toBe("crt");
  });

  it("is empty when the URL carries none", () => {
    expect(certificateExtension("https://x/y/tenant_3rdparty")).toBe("");
  });
});

describe("certificateExpiry", () => {
  const at = (iso: string) => new Date(iso);

  it("is null when nothing was read", () => {
    expect(certificateExpiry(provider({ itemId: "1" }))).toBeNull();
  });

  it("is null when the stored value will not parse", () => {
    expect(
      certificateExpiry(provider({ itemId: "1", certificateNotAfter: "not-a-date" })),
    ).toBeNull();
  });

  it("reports a healthy certificate", () => {
    const result = certificateExpiry(
      provider({ itemId: "1", certificateNotAfter: "2027-09-08T17:23:10Z" }),
      at("2026-09-17T00:00:00Z"),
    );

    expect(result!.expired).toBe(false);
    expect(result!.expiringSoon).toBe(false);
    expect(result!.daysLeft).toBeGreaterThan(300);
  });

  it("flags one inside the rotation window", () => {
    // Thirty days is what a rotation realistically needs: the provider issues the replacement
    // and someone here uploads it, and until then every token is refused.
    const result = certificateExpiry(
      provider({ itemId: "1", certificateNotAfter: "2026-10-01T00:00:00Z" }),
      at("2026-09-17T00:00:00Z"),
    );

    expect(result!.expiringSoon).toBe(true);
    expect(result!.expired).toBe(false);
    expect(result!.daysLeft).toBe(14);
  });

  it("flags one that has already lapsed", () => {
    const result = certificateExpiry(
      provider({ itemId: "1", certificateNotAfter: "2026-09-10T00:00:00Z" }),
      at("2026-09-17T00:00:00Z"),
    );

    expect(result!.expired).toBe(true);
    expect(result!.daysLeft).toBeLessThan(0);
  });
});

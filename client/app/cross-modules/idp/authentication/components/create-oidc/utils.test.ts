import { describe, expect, it } from "vitest";
import {
  redirectUriSubmitSchema,
  createOidcSchema,
  createOIDCFormDefaultValue,
  deriveApplicationType,
  getRedirectUriError,
  getRedirectUriSchema,
  HTTPS_REDIRECT_URI_MESSAGE,
  isAppSchemeRedirectUri,
  MOBILE_INVALID_REDIRECT_URI_MESSAGE,
  WEB_APP_SCHEME_REDIRECT_URI_MESSAGE,
} from "./utils";

describe("redirectUriSubmitSchema", () => {
  it("accepts https urls", () => {
    expect(redirectUriSubmitSchema.safeParse([{ value: "https://app.example.com/cb" }]).success).toBe(
      true,
    );
  });

  it("allows http only for localhost and 127.0.0.1", () => {
    expect(redirectUriSubmitSchema.safeParse([{ value: "http://localhost:3000/cb" }]).success).toBe(
      true,
    );
    expect(redirectUriSubmitSchema.safeParse([{ value: "http://127.0.0.1/cb" }]).success).toBe(true);
  });

  it("rejects http for non-localhost hosts", () => {
    const result = redirectUriSubmitSchema.safeParse([{ value: "http://example.com/cb" }]);
    expect(result.success).toBe(false);
  });

  it("rejects an empty redirect uri value", () => {
    const result = redirectUriSubmitSchema.safeParse([{ value: "" }]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Redirect URI is required");
    }
  });

  it("rejects an empty list", () => {
    expect(redirectUriSubmitSchema.safeParse([]).success).toBe(false);
  });

  it("rejects a malformed url", () => {
    expect(redirectUriSubmitSchema.safeParse([{ value: "not a url" }]).success).toBe(false);
  });
});

describe("createOidcSchema", () => {
  it("validates a filled-in form value", () => {
    expect(
      createOidcSchema.safeParse({
        ...createOIDCFormDefaultValue,
        clientDisplayName: "My App",
        redirectUris: [{ value: "https://app.example.com/cb" }],
      }).success,
    ).toBe(true);
  });

  it("treats the default form value as invalid until a display name is set", () => {
    // the default is the initial form state and intentionally has an empty name
    expect(createOidcSchema.safeParse(createOIDCFormDefaultValue).success).toBe(false);
  });

  it("requires a client display name", () => {
    const result = createOidcSchema.safeParse({ ...createOIDCFormDefaultValue, clientDisplayName: "" });
    expect(result.success).toBe(false);
  });

  it("requires at least one response type for a standard OIDC client", () => {
    const result = createOidcSchema.safeParse({
      ...createOIDCFormDefaultValue,
      allowedResponseTypes: [],
    });
    expect(result.success).toBe(false);
  });

  it("requires a redirect URI for a standard OIDC client", () => {
    const result = createOidcSchema.safeParse({
      ...createOIDCFormDefaultValue,
      clientDisplayName: "Standard Client",
      redirectUris: [{ value: "" }],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Redirect URI is required");
    }
  });

  it("allows empty response types for a device-flow client", () => {
    const result = createOidcSchema.safeParse({
      ...createOIDCFormDefaultValue,
      clientDisplayName: "Device Client",
      isDeviceFlowClient: true,
      allowedResponseTypes: [],
    });
    expect(result.success).toBe(true);
  });
});

describe("isAppSchemeRedirectUri (blocks-iam SPEC29 6.1)", () => {
  it.each([
    "com.klaxai.app://login/callback",
    "com.example.app://callback",
    "com.example.app:/callback",
    "Com.Example-App+x://cb",
    "com.example.app://cb?state=1",
  ])("accepts %s", (value) => {
    expect(isAppSchemeRedirectUri(value)).toBe(true);
  });

  it.each([
    ["no dot in scheme", "myapp://callback"],
    ["javascript", "javascript:alert(1)"],
    ["data", "data:text/html,hi"],
    ["file", "file:///etc/passwd"],
    ["vbscript", "vbscript:msgbox(1)"],
    ["blob", "blob:https://example.com/abc"],
    ["about", "about:blank"],
    ["fragment", "com.example.app://cb#x"],
    ["empty fragment", "com.example.app://cb#"],
    ["https", "https://app.example.com/cb"],
    ["http localhost", "http://localhost:3000/cb"],
    ["unparseable", "not a url"],
    ["scheme starting with a digit", "1com.example://cb"],
  ])("rejects %s", (_label, value) => {
    expect(isAppSchemeRedirectUri(value)).toBe(false);
  });
});

describe("getRedirectUriError (spec 6.3 table)", () => {
  it("C1 / Example 3: Web refuses an app-scheme entry with the Mobile type message", () => {
    expect(getRedirectUriError("com.klaxai.app://login/callback", "web")).toBe(
      WEB_APP_SCHEME_REDIRECT_URI_MESSAGE,
    );
    expect(WEB_APP_SCHEME_REDIRECT_URI_MESSAGE).toBe(
      "Mobile app redirect URIs need the Mobile app application type.",
    );
  });

  it("Web keeps the existing https rule for other entries", () => {
    expect(getRedirectUriError("https://portal.example.com/callback", "web")).toBeNull();
    expect(getRedirectUriError("http://localhost:3000/cb", "web")).toBeNull();
    expect(getRedirectUriError("myapp://callback", "web")).toBe(HTTPS_REDIRECT_URI_MESSAGE);
  });

  it("C5: Web shows the existing HTTPS message for http on a non-localhost host", () => {
    expect(getRedirectUriError("http://portal.example.com/cb", "web")).toBe(
      "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.",
    );
  });

  it("Mobile accepts app-scheme URIs (H3) and https on a public domain (H4)", () => {
    expect(getRedirectUriError("com.klaxai.app://login/callback", "mobile")).toBeNull();
    expect(getRedirectUriError("https://portal.example.com/callback", "mobile")).toBeNull();
    expect(getRedirectUriError("http://localhost:3000/cb", "mobile")).toBeNull();
  });

  it("C2 / Example 4: Mobile refuses a scheme without a dot", () => {
    expect(getRedirectUriError("myapp://callback", "mobile")).toBe(
      "Enter an HTTPS URL or a mobile app URI such as com.example.app://callback.",
    );
  });

  it.each([
    "javascript:alert(1)",
    "data:text/html,hi",
    "file:///tmp/x",
    "vbscript:msgbox(1)",
    "blob:https://example.com/abc",
    "about:blank",
  ])("C3: Mobile refuses %s", (value) => {
    expect(getRedirectUriError(value, "mobile")).toBe(MOBILE_INVALID_REDIRECT_URI_MESSAGE);
  });

  it("C4: Mobile refuses an app-scheme entry with a fragment", () => {
    expect(getRedirectUriError("com.blocks.e2e.app://cb#x", "mobile")).toBe(
      MOBILE_INVALID_REDIRECT_URI_MESSAGE,
    );
  });

  it("Mobile refuses http on a non-localhost host", () => {
    expect(getRedirectUriError("http://portal.example.com/cb", "mobile")).toBe(
      MOBILE_INVALID_REDIRECT_URI_MESSAGE,
    );
  });
});

describe("getRedirectUriSchema", () => {
  it("keeps the empty and at-least-one rules for both types", () => {
    for (const type of ["web", "mobile"] as const) {
      expect(getRedirectUriSchema(type).safeParse([]).success).toBe(false);
      const empty = getRedirectUriSchema(type).safeParse([{ value: "  " }]);
      expect(empty.success).toBe(false);
      if (!empty.success) expect(empty.error.issues[0].message).toBe("Redirect URI is required");
    }
  });

  it("reports the message under the failing entry index", () => {
    const result = getRedirectUriSchema("web").safeParse([
      { value: "https://ok.example.com/cb" },
      { value: "com.klaxai.app://login/callback" },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toHaveLength(1);
      expect(result.error.issues[0].path).toEqual([1, "value"]);
      expect(result.error.issues[0].message).toBe(WEB_APP_SCHEME_REDIRECT_URI_MESSAGE);
    }
  });

  it("redirectUriSubmitSchema keeps today's Web-only behaviour", () => {
    const result = redirectUriSubmitSchema.safeParse([
      { value: "com.klaxai.app://login/callback" },
    ]);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].message).toBe(HTTPS_REDIRECT_URI_MESSAGE);
  });
});

describe("createOidcSchema application type", () => {
  const base = { ...createOIDCFormDefaultValue, clientDisplayName: "Klax" };

  it("defaults to Web with no stored client type", () => {
    expect(createOIDCFormDefaultValue.applicationType).toBe("web");
    expect(createOIDCFormDefaultValue.storedClientType).toBeNull();
    expect(createOIDCFormDefaultValue.storedUseTokensCookie).toBe(true);
    expect(createOIDCFormDefaultValue.loadedApplicationType).toBeNull();
  });

  it("accepts an app-scheme URI only for Mobile", () => {
    const redirectUris = [{ value: "com.klaxai.app://login/callback" }];
    expect(
      createOidcSchema.safeParse({ ...base, redirectUris, applicationType: "mobile" }).success,
    ).toBe(true);
    const web = createOidcSchema.safeParse({ ...base, redirectUris, applicationType: "web" });
    expect(web.success).toBe(false);
    if (!web.success) {
      expect(web.error.issues[0].path).toEqual(["redirectUris", 0, "value"]);
      expect(web.error.issues[0].message).toBe(WEB_APP_SCHEME_REDIRECT_URI_MESSAGE);
    }
  });

  it("skips redirect validation for device flow whatever the type", () => {
    expect(
      createOidcSchema.safeParse({
        ...base,
        applicationType: "mobile",
        isDeviceFlowClient: true,
        redirectUris: [{ value: "myapp://cb" }],
        allowedResponseTypes: [],
      }).success,
    ).toBe(true);
  });
});

describe("deriveApplicationType (spec 6.2)", () => {
  it("is Mobile only for a non-device public client without cookie delivery", () => {
    expect(deriveApplicationType({ clientType: "public", useTokensCookie: false })).toBe("mobile");
    expect(deriveApplicationType({ clientType: "PUBLIC", useTokensCookie: false })).toBe("mobile");
  });

  it.each([
    [{ clientType: "public", useTokensCookie: true }],
    [{ clientType: "public" }],
    [{ clientType: "confidential", useTokensCookie: false }],
    [{ clientType: null, useTokensCookie: false }],
    [{}],
    [{ clientType: "public", useTokensCookie: false, isDeviceFlowClient: true }],
  ])("is Web for %j", (credential) => {
    expect(deriveApplicationType(credential)).toBe("web");
  });
});

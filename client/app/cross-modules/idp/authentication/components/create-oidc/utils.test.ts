import { describe, expect, it } from "vitest";
import {
  buildTokenLifetimesPayload,
  EMPTY_TOKEN_LIFETIMES,
  redirectUriSubmitSchema,
  createOidcSchema,
  createOIDCFormDefaultValue,
  deriveApplicationType,
  describeTokenLifetime,
  formatMinutes,
  getRedirectUriError,
  getRedirectUriSchema,
  HTTPS_REDIRECT_URI_MESSAGE,
  isAppSchemeRedirectUri,
  knownMinutes,
  MOBILE_INVALID_REDIRECT_URI_MESSAGE,
  WEB_APP_SCHEME_REDIRECT_URI_MESSAGE,
  TOKEN_LIFETIME_MESSAGES,
  type TokenLifetimeFormValues,
  tokenLifetimesToForm,
} from "./utils";

describe("redirectUriSubmitSchema", () => {
  it("accepts https urls", () => {
    expect(
      redirectUriSubmitSchema.safeParse([{ value: "https://app.example.com/cb" }]).success,
    ).toBe(true);
  });

  it("allows http only for localhost and 127.0.0.1", () => {
    expect(redirectUriSubmitSchema.safeParse([{ value: "http://localhost:3000/cb" }]).success).toBe(
      true,
    );
    expect(redirectUriSubmitSchema.safeParse([{ value: "http://127.0.0.1/cb" }]).success).toBe(
      true,
    );
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
    const result = createOidcSchema.safeParse({
      ...createOIDCFormDefaultValue,
      clientDisplayName: "",
    });
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
    "com.a.app://cb",
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
    ["tab inside the scheme (URL parser would strip it)", "com.a\tpp.x://cb"],
    ["leading control character (URL parser would strip it)", "\u0001com.a.app://cb"],
    ["no scheme before the colon", "://cb"],
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

// ---------- per-client token lifetimes (blocks-os SPEC3) ----------

const validWebValues = {
  ...createOIDCFormDefaultValue,
  clientDisplayName: "App",
  redirectUris: [{ value: "https://app.example.com/cb" }],
};

const lifetimeErrors = (
  overrides: Partial<Record<keyof TokenLifetimeFormValues, string>>,
  base: Record<string, unknown> = validWebValues,
) => {
  const result = createOidcSchema.safeParse({ ...base, ...overrides });
  return result.success
    ? []
    : result.error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message }));
};

describe("token lifetime rules", () => {
  it("accepts empty inputs (project setting)", () => {
    expect(lifetimeErrors({})).toEqual([]);
  });

  it.each([
    ["1", "1", "1"],
    ["1440", "525600", "525600"],
    ["30", "1440", "43200"],
    ["", "600", "600"],
    [" 30 ", "", ""],
  ])("accepts %s / %s / %s", (access, refresh, absolute) => {
    expect(
      lifetimeErrors({
        accessTokenLifetime: access,
        refreshTokenLifetime: refresh,
        absoluteRefreshTokenLifetime: absolute,
      }),
    ).toEqual([]);
  });

  it.each(["0", "1441", "99999"])("rejects access %s with the server message", (value) => {
    expect(lifetimeErrors({ accessTokenLifetime: value })).toEqual([
      { path: "accessTokenLifetime", message: TOKEN_LIFETIME_MESSAGES.access },
    ]);
  });

  it.each(["0", "525601"])("rejects idle and maximum %s", (value) => {
    expect(lifetimeErrors({ refreshTokenLifetime: value })).toEqual([
      { path: "refreshTokenLifetime", message: TOKEN_LIFETIME_MESSAGES.refresh },
    ]);
    expect(lifetimeErrors({ absoluteRefreshTokenLifetime: value })).toEqual([
      { path: "absoluteRefreshTokenLifetime", message: TOKEN_LIFETIME_MESSAGES.absolute },
    ]);
  });

  it("rejects a maximum below the idle lifetime on the maximum field", () => {
    expect(
      lifetimeErrors({ refreshTokenLifetime: "600", absoluteRefreshTokenLifetime: "599" }),
    ).toEqual([
      {
        path: "absoluteRefreshTokenLifetime",
        message: TOKEN_LIFETIME_MESSAGES.absoluteBelowRefresh,
      },
    ]);
  });

  it.each(["1.5", "-3", "abc", "1e3"])("rejects %s as not a whole number", (value) => {
    expect(lifetimeErrors({ accessTokenLifetime: value })).toEqual([
      { path: "accessTokenLifetime", message: TOKEN_LIFETIME_MESSAGES.wholeNumber },
    ]);
  });

  it("checks lifetimes for device-flow clients too", () => {
    expect(
      lifetimeErrors(
        { accessTokenLifetime: "0" },
        { ...createOIDCFormDefaultValue, clientDisplayName: "Cli", isDeviceFlowClient: true },
      ),
    ).toEqual([{ path: "accessTokenLifetime", message: TOKEN_LIFETIME_MESSAGES.access }]);
  });
});

describe("tokenLifetimesToForm", () => {
  it("maps stored values and leaves unset ones empty", () => {
    expect(
      tokenLifetimesToForm({
        accessTokenValidForNumberMinutes: 30,
        refreshTokenValidForNumberMinutes: null,
        absoluteRefreshTokenValidForNumberMinutes: 43200,
      }),
    ).toEqual({
      accessTokenLifetime: "30",
      refreshTokenLifetime: "",
      absoluteRefreshTokenLifetime: "43200",
    });
  });

  it.each([null, undefined])("maps %s to empty inputs", (value) => {
    expect(tokenLifetimesToForm(value)).toEqual(EMPTY_TOKEN_LIFETIMES);
  });

  it("keeps a bad stored value visible", () => {
    expect(
      tokenLifetimesToForm({
        accessTokenValidForNumberMinutes: 0,
        refreshTokenValidForNumberMinutes: null,
        absoluteRefreshTokenValidForNumberMinutes: null,
      }).accessTokenLifetime,
    ).toBe("0");
  });
});

describe("buildTokenLifetimesPayload", () => {
  it("returns undefined when nothing changed", () => {
    expect(
      buildTokenLifetimesPayload(EMPTY_TOKEN_LIFETIMES, EMPTY_TOKEN_LIFETIMES),
    ).toBeUndefined();
    const loaded = {
      accessTokenLifetime: "30",
      refreshTokenLifetime: "",
      absoluteRefreshTokenLifetime: "43200",
    };
    expect(buildTokenLifetimesPayload({ ...loaded }, loaded)).toBeUndefined();
  });

  it("treats whitespace-only edits as unchanged", () => {
    expect(
      buildTokenLifetimesPayload(
        { ...EMPTY_TOKEN_LIFETIMES, accessTokenLifetime: "  " },
        EMPTY_TOKEN_LIFETIMES,
      ),
    ).toBeUndefined();
  });

  it("sends all three as numbers or null when one changed", () => {
    expect(
      buildTokenLifetimesPayload(
        {
          accessTokenLifetime: "45",
          refreshTokenLifetime: "",
          absoluteRefreshTokenLifetime: "43200",
        },
        {
          accessTokenLifetime: "30",
          refreshTokenLifetime: "",
          absoluteRefreshTokenLifetime: "43200",
        },
      ),
    ).toEqual({
      accessTokenValidForNumberMinutes: 45,
      refreshTokenValidForNumberMinutes: null,
      absoluteRefreshTokenValidForNumberMinutes: 43200,
    });
  });

  it("sends three nulls when all were cleared", () => {
    expect(
      buildTokenLifetimesPayload(EMPTY_TOKEN_LIFETIMES, {
        accessTokenLifetime: "30",
        refreshTokenLifetime: "1440",
        absoluteRefreshTokenLifetime: "43200",
      }),
    ).toEqual({
      accessTokenValidForNumberMinutes: null,
      refreshTokenValidForNumberMinutes: null,
      absoluteRefreshTokenValidForNumberMinutes: null,
    });
  });
});

describe("formatMinutes", () => {
  it.each([
    [1, "1 min"],
    [45, "45 min"],
    [60, "1 hour"],
    [90, "1 h 30 min"],
    [120, "2 hours"],
    [1440, "1 day"],
    [43200, "30 days"],
  ])("%i -> %s", (minutes, text) => {
    expect(formatMinutes(minutes)).toBe(text);
  });
});

describe("knownMinutes", () => {
  it.each([
    [60, 60],
    [0, undefined],
    [-5, undefined],
    [null, undefined],
    [undefined, undefined],
  ])("%s -> %s", (value, expected) => {
    expect(knownMinutes(value)).toBe(expected);
  });
});

describe("describeTokenLifetime", () => {
  it("names the project value for an empty input", () => {
    expect(describeTokenLifetime("", 60)).toBe("Uses project setting: 1 hour.");
    expect(describeTokenLifetime("  ", 1440)).toBe("Uses project setting: 1 day.");
  });

  it("falls back to a plain line when the project value is unknown", () => {
    expect(describeTokenLifetime("")).toBe("Uses project setting.");
    expect(describeTokenLifetime("90")).toBe("= 1 h 30 min");
  });

  it("shows a typed value next to the project value", () => {
    expect(describeTokenLifetime("1440", 60)).toBe("= 1 day · project: 1 hour");
  });

  it.each(["0", "-1", "1.5", "abc"])("returns nothing for the invalid value %s", (raw) => {
    expect(describeTokenLifetime(raw, 60)).toBe("");
  });
});

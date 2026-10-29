import { describe, expect, it, vi } from "vitest";

const IAM_BASE_URL = "https://dev-iam.blocksdevelopers.com";

vi.mock("@/lib/runtime-env", () => ({
  getRuntimeEnv: (key: string) => (key === "BLOCKS_IAM_BASE_URL" ? IAM_BASE_URL : ""),
}));

const {
  applyOidcIamConfigOverrides,
  authSettingsFormSchema,
  buildSavePayload,
  iamConfigFormSchema,
  toIamConfigFormValues,
} = await import("./auth-config-form");

type IamConfigFormValues = ReturnType<typeof toIamConfigFormValues>;

const iamConfigFormValues = (
  overrides: Partial<IamConfigFormValues> = {},
): IamConfigFormValues => ({
  accountActivationPath: "activate",
  accountVerificationPath: "verify",
  recoverAccountPath: "resetpassword",
  accountActionBaseUrl: "https://console.enterprise.cloud",
  useAccountActionBaseUrlAsDefault: true,
  activationUrlLifetimeInMinutes: 1440,
  recoverAccountUrlLifetimeInMinutes: 10,
  logoutOnPasswordChange: true,
  isOidcEnabled: false,
  passwordStrengthCheckerRegex: "",
  collectPasswordOnActivation: true,
  ...overrides,
});

/** Mirrors a project seeded with the `https://example.com` domain at creation. */
const savedConfig = {
  itemId: "6a3130b3fefe3615abcc8cf1",
  refreshTokenValidForNumberMinutes: 30,
  absoluteRefreshTokenValidForNumberMinutes: 30,
  accessTokenValidForNumberMinutes: 7,
  rememberMeRefreshTokenValidForNumberMinutes: 43200,
  getNumberOfWrongAttemptsToLockTheAccount: 5,
  accountLockDurationInMinutes: 5,
  publicCertificatePath: "https://blocksdev.blob.core.windows.net/cert.pfx",
  accountActivationPath: "activate",
  accountVerificationPath: "verify",
  recoverAccountPath: "resetpassword",
  isOidcEnabled: true,
  accountActionBaseUrl: "https://example.com",
  useAccountActionBaseUrlAsDefault: false,
  activationUrlLifetimeInMinutes: 1440,
  recoverAccountUrlLifetimeInMinutes: 10,
  logoutOnPasswordChange: true,
  passwordStrengthCheckerRegex: "",
  collectPasswordOnActivation: true,
  allowedGrantTypes: ["password"],
};

describe("toIamConfigFormValues", () => {
  it("defaults the base URL to the IAM host when OIDC is enabled", () => {
    expect(toIamConfigFormValues(savedConfig).accountActionBaseUrl).toBe(IAM_BASE_URL);
  });

  it("keeps the stored base URL when OIDC is disabled", () => {
    const values = toIamConfigFormValues({ ...savedConfig, isOidcEnabled: false });

    expect(values.accountActionBaseUrl).toBe("https://example.com");
  });
});

describe("applyOidcIamConfigOverrides", () => {
  it("sets the base URL to the IAM host when OIDC is enabled", () => {
    const result = applyOidcIamConfigOverrides(
      iamConfigFormValues({ isOidcEnabled: true, accountActionBaseUrl: "" }),
    );

    expect(result.accountActionBaseUrl).toBe(IAM_BASE_URL);
    expect(result.useAccountActionBaseUrlAsDefault).toBe(false);
  });

  it("leaves the base URL alone when OIDC is disabled", () => {
    const values = iamConfigFormValues({ isOidcEnabled: false });

    expect(applyOidcIamConfigOverrides(values)).toEqual(values);
  });

  it("sends the IAM host rather than the stale saved base URL", () => {
    const payload = buildSavePayload(
      savedConfig,
      applyOidcIamConfigOverrides(toIamConfigFormValues(savedConfig)),
    );

    expect(payload.accountActionBaseUrl).toBe(IAM_BASE_URL);
    expect(payload.useAccountActionBaseUrlAsDefault).toBe(false);
  });
});

describe("collectPasswordOnActivation", () => {
  it("carries the stored value into the form", () => {
    const values = toIamConfigFormValues({ ...savedConfig, collectPasswordOnActivation: false });

    expect(values.collectPasswordOnActivation).toBe(false);
  });

  it("sends the edited value rather than the saved one", () => {
    const payload = buildSavePayload(
      savedConfig,
      iamConfigFormValues({ collectPasswordOnActivation: false }),
    );

    expect(payload.collectPasswordOnActivation).toBe(false);
  });

  it("falls back to the saved value when the form does not override it", () => {
    const payload = buildSavePayload({ ...savedConfig, collectPasswordOnActivation: false }, {});

    expect(payload.collectPasswordOnActivation).toBe(false);
  });
});

describe("iamConfigFormSchema", () => {
  it("requires a base URL when OIDC is disabled", () => {
    const result = iamConfigFormSchema.safeParse(
      iamConfigFormValues({ isOidcEnabled: false, accountActionBaseUrl: "" }),
    );

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["accountActionBaseUrl"]);
  });

  it("rejects a blank base URL when OIDC is disabled", () => {
    const result = iamConfigFormSchema.safeParse(
      iamConfigFormValues({ isOidcEnabled: false, accountActionBaseUrl: "   " }),
    );

    expect(result.success).toBe(false);
  });

  it("allows an empty base URL when OIDC is enabled", () => {
    const result = iamConfigFormSchema.safeParse(
      iamConfigFormValues({ isOidcEnabled: true, accountActionBaseUrl: "" }),
    );

    expect(result.success).toBe(true);
  });
});

describe("authSettingsFormSchema", () => {
  const baseValues = {
    accessTokenValidForNumberMinutes: 10,
    refreshTokenValidForNumberMinutes: 10,
    absoluteRefreshTokenValidForNumberMinutes: 10,
    rememberMeRefreshTokenValidForNumberMinutes: 10,
    getNumberOfWrongAttemptsToLockTheAccount: 3,
    accountLockDurationInMinutes: 5,
    publicCertificatePath: "https://example.com/cert.pfx",
  };

  it("accepts a typical configuration", () => {
    expect(authSettingsFormSchema.safeParse(baseValues).success).toBe(true);
  });

  it.each([
    "accessTokenValidForNumberMinutes",
    "refreshTokenValidForNumberMinutes",
    "absoluteRefreshTokenValidForNumberMinutes",
    "rememberMeRefreshTokenValidForNumberMinutes",
    "getNumberOfWrongAttemptsToLockTheAccount",
    "accountLockDurationInMinutes",
  ] as const)("rejects zero for %s", (field) => {
    const result = authSettingsFormSchema.safeParse({ ...baseValues, [field]: 0 });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("Value must be greater than zero.");
  });
});

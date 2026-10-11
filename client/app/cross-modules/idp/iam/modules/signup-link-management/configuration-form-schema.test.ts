import { describe, expect, it } from "vitest";
import {
  signupLinkConfigurationFormDefaults,
  signupLinkConfigurationFormSchema,
  toModePayload,
} from "./configuration-form-schema";

describe("signupLinkConfigurationFormSchema", () => {
  const valid = {
    name: "Partner onboarding",
    description: "",
    mode: "Oidc" as const,
    clientId: "partner-portal",
    redirectUri: "https://partner.example.com/callback",
    defaultForwardedTo: "",
    credentialMode: "Passwordless" as const,
    defaultLifetimeMinutes: 1440,
    defaultRoles: ["partner-user"],
    defaultPermissions: [],
    joinUrl: "",
  };

  const embedded = {
    ...valid,
    mode: "Embedded" as const,
    clientId: "",
    redirectUri: "",
  };

  it("accepts a valid payload", () => {
    expect(signupLinkConfigurationFormSchema.safeParse(valid).success).toBe(true);
  });

  it("requires name, client and redirect URI", () => {
    const result = signupLinkConfigurationFormSchema.safeParse({
      ...valid,
      name: "",
      clientId: "",
      redirectUri: "",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path[0]);
      expect(paths).toEqual(expect.arrayContaining(["name", "clientId", "redirectUri"]));
    }
  });

  it("rejects non-absolute redirect URIs", () => {
    const result = signupLinkConfigurationFormSchema.safeParse({
      ...valid,
      redirectUri: "/callback",
    });
    expect(result.success).toBe(false);
  });

  it("rejects lifetime outside 5..10080", () => {
    expect(
      signupLinkConfigurationFormSchema.safeParse({ ...valid, defaultLifetimeMinutes: 10081 })
        .success,
    ).toBe(false);
    expect(
      signupLinkConfigurationFormSchema.safeParse({ ...valid, defaultLifetimeMinutes: 10080 })
        .success,
    ).toBe(true);
  });

  it("rejects forwarded paths that are not relative", () => {
    expect(
      signupLinkConfigurationFormSchema.safeParse({
        ...valid,
        defaultForwardedTo: "https://evil.example",
      }).success,
    ).toBe(false);
    expect(
      signupLinkConfigurationFormSchema.safeParse({
        ...valid,
        defaultForwardedTo: "/welcome",
      }).success,
    ).toBe(true);
  });

  it("caps permissions at 50", () => {
    const result = signupLinkConfigurationFormSchema.safeParse({
      ...valid,
      defaultPermissions: Array.from({ length: 51 }, (_, i) => `p${i}`),
    });
    expect(result.success).toBe(false);
  });

  it("accepts an embedded configuration with no client or redirect", () => {
    expect(signupLinkConfigurationFormSchema.safeParse(embedded).success).toBe(true);
  });

  it("accepts an embedded configuration with a valid join URL", () => {
    expect(
      signupLinkConfigurationFormSchema.safeParse({
        ...embedded,
        joinUrl: "https://app.example.com/join",
      }).success,
    ).toBe(true);
  });

  it.each([
    ["http://app.example.com/join"],
    ["https://app.example.com/join?x=1"],
    ["https://app.example.com/join#a"],
    ["/join"],
  ])("rejects the malformed join URL %s", (joinUrl) => {
    const result = signupLinkConfigurationFormSchema.safeParse({ ...embedded, joinUrl });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.path[0])).toContain("joinUrl");
    }
  });

  it("does not demand a client or redirect in embedded mode", () => {
    const result = signupLinkConfigurationFormSchema.safeParse({ ...embedded, joinUrl: "" });
    expect(result.success).toBe(true);
  });

  describe("toModePayload", () => {
    it("drops client and redirect for an embedded configuration", () => {
      const payload = toModePayload(
        { clientId: "c", redirectUri: "https://x.example/cb", joinUrl: "https://app/join" },
        "Embedded",
      );
      expect(payload).toEqual({ joinUrl: "https://app/join" });
    });

    it("drops the join URL for an OIDC configuration", () => {
      const payload = toModePayload(
        { clientId: "c", redirectUri: "https://x.example/cb", joinUrl: "https://app/join" },
        "Oidc",
      );
      expect(payload).toEqual({ clientId: "c", redirectUri: "https://x.example/cb" });
    });
  });

  describe("max redemptions and existing-user password (#645)", () => {
    const issuesFor = (defaultMaxRedemptions: string) => {
      const result = signupLinkConfigurationFormSchema.safeParse({
        ...valid,
        defaultMaxRedemptions,
      });
      return result.success
        ? []
        : result.error.issues
            .filter((issue) => issue.path[0] === "defaultMaxRedemptions")
            .map((issue) => issue.message);
    };

    it("defaults the switch on and Max redemptions empty (H1, H7)", () => {
      expect(signupLinkConfigurationFormDefaults.requireExistingUserPassword).toBe(true);
      expect(signupLinkConfigurationFormDefaults.defaultMaxRedemptions).toBe("");
      const parsed = signupLinkConfigurationFormSchema.parse(valid);
      expect(parsed.requireExistingUserPassword).toBe(true);
      expect(parsed.defaultMaxRedemptions).toBe("");
    });

    it.each(["-1", "1.5", "abc", "1e3", "+3", " 2 3"])(
      "rejects %j with 'Enter 0 or a whole number' (C1)",
      (value) => {
        expect(issuesFor(value)).toEqual(["Enter 0 or a whole number"]);
      },
    );

    it("rejects values above the Int32 limit (C2)", () => {
      expect(issuesFor("3000000000")).toEqual(["Enter a smaller number"]);
      expect(issuesFor("2147483648")).toEqual(["Enter a smaller number"]);
      expect(issuesFor("2147483647")).toEqual([]);
    });

    it.each(["", "0", "1", "5", " 7 "])("accepts %j", (value) => {
      expect(issuesFor(value)).toEqual([]);
    });

    it("keeps an empty field as an empty string, never 0 (C3)", () => {
      const parsed = signupLinkConfigurationFormSchema.parse({
        ...valid,
        defaultMaxRedemptions: "",
      });
      expect(parsed.defaultMaxRedemptions).toBe("");
    });

    it("keeps requireExistingUserPassword through toModePayload in both modes (C6)", () => {
      expect(
        toModePayload(
          { requireExistingUserPassword: false, credentialMode: "Passwordless" },
          "Embedded",
        ).requireExistingUserPassword,
      ).toBe(false);
      expect(
        toModePayload(
          { requireExistingUserPassword: true, credentialMode: "PasswordRequired" },
          "Oidc",
        ).requireExistingUserPassword,
      ).toBe(true);
    });
  });
});

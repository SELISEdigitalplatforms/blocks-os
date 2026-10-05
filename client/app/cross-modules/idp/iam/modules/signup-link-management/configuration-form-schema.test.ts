import { describe, expect, it } from "vitest";
import {
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
});

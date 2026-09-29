import { describe, expect, it } from "vitest";
import { signupLinkConfigurationFormSchema } from "./configuration-form-schema";

describe("signupLinkConfigurationFormSchema", () => {
  const valid = {
    name: "Partner onboarding",
    description: "",
    clientId: "partner-portal",
    redirectUri: "https://partner.example.com/callback",
    defaultForwardedTo: "",
    credentialMode: "Passwordless" as const,
    defaultLifetimeMinutes: 1440,
    defaultRoles: ["partner-user"],
    defaultPermissions: [],
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
});

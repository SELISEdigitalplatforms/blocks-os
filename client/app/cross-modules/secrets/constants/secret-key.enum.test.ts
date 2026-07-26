import { describe, expect, it } from "vitest";
import { SecretType, SECRET_TYPE_OPTIONS } from "./secret-key.enum";

describe("secret-key enum", () => {
  it("defines the supported secret types", () => {
    expect(SecretType.OIDC).toBe("OIDC");
    expect(SecretType.Captcha).toBe("Captcha");
    expect(SecretType.ExternalIdP).toBe("ExternalIdP");
  });

  it("exposes user-facing options with friendly labels", () => {
    const labels = SECRET_TYPE_OPTIONS.map((o) => o.label);
    expect(labels).toContain("Bring your own SSO");
    expect(SECRET_TYPE_OPTIONS.find((o) => o.value === SecretType.OIDC)?.label).toBe("OIDC");
    expect(SECRET_TYPE_OPTIONS).toHaveLength(4);
  });
});

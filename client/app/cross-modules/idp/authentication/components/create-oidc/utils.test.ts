import { describe, expect, it } from "vitest";
import {
  redirectUriSubmitSchema,
  createOidcSchema,
  createOIDCFormDefaultValue,
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
      createOidcSchema.safeParse({ ...createOIDCFormDefaultValue, clientDisplayName: "My App" })
        .success,
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

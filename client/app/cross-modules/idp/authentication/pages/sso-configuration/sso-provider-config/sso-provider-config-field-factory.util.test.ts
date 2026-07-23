import { describe, expect, it } from "vitest";
import {
  createProviderField,
  createNameField,
  createClientIdField,
  createClientSecretField,
  createRedirectUrlField,
  createAudienceField,
  createCommonOAuthFields,
} from "./sso-provider-config-field-factory.util";

describe("sso-provider-config-field-factory", () => {
  describe("createProviderField", () => {
    it("creates a password field for the password type", () => {
      const field = createProviderField("1", "Secret", "secret", "password");
      expect(field).toMatchObject({ id: "1", label: "Secret", name: "secret", type: "password" });
    });

    it("defaults any other type to input", () => {
      const field = createProviderField("2", "Name", "name", "select");
      expect(field.type).toBe("input");
    });

    it("applies overrides", () => {
      const field = createProviderField("3", "X", "x", "input", { isDisabled: true });
      expect(field.isDisabled).toBe(true);
    });
  });

  it("createNameField is disabled and has a description", () => {
    const field = createNameField();
    expect(field).toMatchObject({ name: "provider", isDisabled: true });
    expect(field.description).toBeTruthy();
  });

  it("createClientIdField targets the clientId name", () => {
    expect(createClientIdField().name).toBe("clientId");
  });

  it("createClientSecretField is a password with a description", () => {
    const field = createClientSecretField();
    expect(field.type).toBe("password");
    expect(field.name).toBe("clientSecret");
  });

  it("createRedirectUrlField and createAudienceField target their names", () => {
    expect(createRedirectUrlField().name).toBe("redirectUrl");
    expect(createAudienceField().name).toBe("audience");
  });

  describe("createCommonOAuthFields", () => {
    it("returns all five common fields in order", () => {
      const fields = createCommonOAuthFields();
      expect(fields.map((f) => f.name)).toEqual([
        "provider",
        "clientId",
        "clientSecret",
        "redirectUrl",
        "audience",
      ]);
    });

    it("forwards per-field overrides", () => {
      const fields = createCommonOAuthFields({ clientId: { isDisabled: true } });
      const clientId = fields.find((f) => f.name === "clientId");
      expect(clientId?.isDisabled).toBe(true);
    });
  });
});

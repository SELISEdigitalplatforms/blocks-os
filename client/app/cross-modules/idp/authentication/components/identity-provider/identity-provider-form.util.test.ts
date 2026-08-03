import { describe, expect, it } from "vitest";
import { buildIdentityProviderPayload, deriveProtocol } from "./identity-provider-form.util";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";

const editedProvider: IdentityProvider = {
  itemId: "c5646e6f-d67a-4b03-9c44-d820a04b8ec2",
  provider: "ddd",
  providerType: "blocks-oidc",
  protocol: "oidc",
  displayName: "",
  clientId: "dfasdf",
  clientSecret: "fda",
  tokenEndpointAuthMethod: "client_secret_basic",
  scope: "openid",
  redirectUris: ["https://example.com/callback"],
  isActive: true,
  requirePkce: false,
  initialRoles: [],
  initialPermissions: [],
};

describe("deriveProtocol", () => {
  it("keeps existing protocol when present", () => {
    expect(deriveProtocol("blocks-oidc", "oidc")).toBe("oidc");
  });

  it("defaults blocks-oidc to oidc", () => {
    expect(deriveProtocol("blocks-oidc")).toBe("oidc");
  });

  it("defaults social to oidc", () => {
    expect(deriveProtocol("social")).toBe("oidc");
  });
});

describe("buildIdentityProviderPayload", () => {
  it("merges fetched provider data and keeps protocol on edit", () => {
    const payload = buildIdentityProviderPayload({
      values: {
        displayName: "",
        providerType: "",
        provider: "",
        clientId: "",
        clientSecret: "",
        wellKnownUrl: "",
        audience: "",
      },
      cleanedUris: ["https://example.com/callback"],
      selectedRoles: [],
      selectedPermissions: [],
      requirePkce: false,
      blocksOidcWellKnownUrl: "https://tenant/.well-known/openid-configuration",
      editedProvider,
      editId: editedProvider.itemId,
      isEditing: true,
    });

    expect(payload.provider).toBe("ddd");
    expect(payload.providerType).toBe("blocks-oidc");
    expect(payload.protocol).toBe("oidc");
    expect(payload.clientId).toBe("dfasdf");
    expect(payload.clientSecret).toBe("fda");
    expect(payload.itemId).toBe(editedProvider.itemId);
  });

  it("includes protocol on create", () => {
    const payload = buildIdentityProviderPayload({
      values: {
        displayName: "My Provider",
        providerType: "blocks-oidc",
        provider: "my-provider",
        clientId: "client-id",
        clientSecret: "secret",
        wellKnownUrl: "",
        audience: "",
      },
      cleanedUris: ["https://example.com/callback"],
      selectedRoles: [],
      selectedPermissions: [],
      requirePkce: false,
      blocksOidcWellKnownUrl: "https://tenant/.well-known/openid-configuration",
      isEditing: false,
    });

    expect(payload.protocol).toBe("oidc");
    expect(payload.providerType).toBe("blocks-oidc");
    expect(payload.clientId).toBe("client-id");
  });
});

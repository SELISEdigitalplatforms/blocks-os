import { describe, expect, it } from "vitest";
import {
  addRedirectUriToList,
  buildIdentityProviderPayload,
  buildSocialLoginRedirectUri,
  deriveProtocol,
  getSocialLoginRedirectUri,
  hasRedirectUri,
} from "./identity-provider-form.util";
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
      scopes: [],
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
    // The stored secret is never echoed back: empty means "keep it" on the server.
    expect(payload.clientSecret).toBe("");
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
      scopes: [],
      requirePkce: false,
      blocksOidcWellKnownUrl: "https://tenant/.well-known/openid-configuration",
      isEditing: false,
    });

    expect(payload.protocol).toBe("oidc");
    expect(payload.providerType).toBe("blocks-oidc");
    expect(payload.clientId).toBe("client-id");
  });
});

describe("social login redirect URI helpers", () => {
  const URI = "https://a/cb";
  const IAM = "https://iam.test";
  it("builds the IAM login page redirect URI and trims trailing slashes from the base", () => {
    expect(buildSocialLoginRedirectUri(`${IAM}//`, "google", "t1")).toBe(
      "https://iam.test/oidc/google/callback/t1",
    );
  });

  it.each([
    ["", "google", "t1"],
    [IAM, "", "t1"],
    [IAM, "google", ""],
  ])("returns empty when a part is missing (%s, %s, %s)", (base, provider, tenant) => {
    expect(buildSocialLoginRedirectUri(base, provider, tenant)).toBe("");
  });

  it("is empty for a non-social provider type", () => {
    expect(getSocialLoginRedirectUri(IAM, "byos", "google", "t1")).toBe("");
    expect(getSocialLoginRedirectUri(IAM, "social", "google", "t1")).toBe(
      "https://iam.test/oidc/google/callback/t1",
    );
  });

  it("matches exactly after trimming, case-sensitive", () => {
    expect(hasRedirectUri([` ${URI} `], URI)).toBe(true);
    expect(hasRedirectUri([URI.toUpperCase()], URI)).toBe(false);
    expect(hasRedirectUri([`${URI}/`], URI)).toBe(false);
    expect(hasRedirectUri(undefined, URI)).toBe(false);
    expect(hasRedirectUri([URI], "")).toBe(false);
  });

  it("fills the first empty row, else appends, and never duplicates", () => {
    expect(addRedirectUriToList(["https://x", ""], "https://a")).toEqual(["https://x", "https://a"]);
    expect(addRedirectUriToList(["https://x"], "https://a")).toEqual(["https://x", "https://a"]);
    expect(addRedirectUriToList(["https://a"], "https://a")).toEqual(["https://a"]);
  });
});

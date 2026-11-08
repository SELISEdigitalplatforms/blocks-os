import { describe, expect, it } from "vitest";
import {
  addRedirectUriToList,
  buildIdentityProviderPayload,
  buildSocialLoginRedirectUri,
  deriveProtocol,
  getSocialLoginRedirectUri,
  hasRedirectUri,
  isDisplayNameTaken,
  isValidMicrosoftTenant,
  microsoftDiscoveryUrl,
  microsoftTenantOf,
  suggestDisplayName,
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

describe("Microsoft tenant", () => {
  const TENANT_URL =
    "https://login.microsoftonline.com/contoso.onmicrosoft.com/v2.0/.well-known/openid-configuration";
  const COMMON_URL = "https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration";

  it("builds and reads back a tenant discovery URL", () => {
    expect(microsoftDiscoveryUrl("contoso.onmicrosoft.com")).toBe(TENANT_URL);
    expect(microsoftTenantOf(TENANT_URL)).toBe("contoso.onmicrosoft.com");
  });

  it("reads no tenant from common or from any other URL", () => {
    expect(microsoftTenantOf(COMMON_URL)).toBe("");
    expect(microsoftTenantOf("https://accounts.google.com/.well-known/openid-configuration")).toBe("");
    expect(microsoftTenantOf(undefined)).toBe("");
  });

  it("accepts a directory id or a domain and nothing else", () => {
    expect(isValidMicrosoftTenant("8b1d2c3e-0000-4e72-9a7f-000000000001")).toBe(true);
    expect(isValidMicrosoftTenant("contoso.onmicrosoft.com")).toBe(true);
    expect(isValidMicrosoftTenant("")).toBe(true);
    expect(isValidMicrosoftTenant("contoso/evil")).toBe(false);
    expect(isValidMicrosoftTenant("con toso")).toBe(false);
  });

  const microsoftValues = {
    displayName: "Contoso staff",
    providerType: "social",
    provider: "microsoft",
    clientId: "ms-client",
    clientSecret: "secret",
  };
  const build = (tenant: string, isEditing: boolean) =>
    buildIdentityProviderPayload({
      values: { ...microsoftValues, tenant },
      cleanedUris: ["https://app.example.com/cb"],
      selectedRoles: [],
      selectedPermissions: [],
      scopes: ["openid"],
      requirePkce: false,
      blocksOidcWellKnownUrl: "",
      editedProvider: isEditing
        ? { ...editedProvider, providerType: "social", provider: "microsoft", wellKnownUrl: TENANT_URL }
        : undefined,
      editId: isEditing ? editedProvider.itemId : undefined,
      isEditing,
    });

  it("sends the tenant as its discovery URL", () => {
    expect(build("contoso.onmicrosoft.com", false).wellKnownUrl).toBe(TENANT_URL);
  });

  it("sends nothing for a new entry without a tenant, and common when a saved one is cleared", () => {
    expect(build("", false).wellKnownUrl).toBe("");
    expect(build("", true).wellKnownUrl).toBe(COMMON_URL);
  });
});

describe("display names of several entries", () => {
  const entries = [
    { ...editedProvider, itemId: "g1", provider: "google", providerType: "social", displayName: "Google" },
    { ...editedProvider, itemId: "g2", provider: "google", providerType: "social", displayName: "Staff" },
    { ...editedProvider, itemId: "m1", provider: "microsoft", providerType: "social", displayName: "Staff" },
  ];

  it("treats a name as taken only within the same provider, ignoring case and spaces", () => {
    expect(isDisplayNameTaken(entries, "google", " staff ")).toBe(true);
    expect(isDisplayNameTaken(entries, "microsoft", "Google")).toBe(false);
    expect(isDisplayNameTaken(entries, "google", "Customers")).toBe(false);
  });

  it("does not count the entry being edited", () => {
    expect(isDisplayNameTaken(entries, "google", "Staff", "g2")).toBe(false);
  });

  it("suggests the provider's own name only while it is free", () => {
    expect(suggestDisplayName(entries, "microsoft", "Microsoft")).toBe("Microsoft");
    expect(suggestDisplayName(entries, "google", "Google")).toBe("");
    expect(suggestDisplayName(entries, "google", undefined)).toBe("");
  });
});

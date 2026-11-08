import { IPermission, PermissionSeverityLevel } from "@blocks-idp/iam/models/permission";
import { toRoleStubs } from "@blocks-idp/iam/utils/role-stub";
import {
  IdentityProvider,
  IdentityProviderType,
  Protocol,
} from "@blocks-idp/authentication/models/identity-provider.model";
import { IRole } from "@blocks-idp/iam/models/role";

export { toRoleStubs };

export const toPermissionStub = (resource: string): IPermission => ({
  itemId: resource,
  name: resource,
  type: 1,
  description: "",
  resource,
  resourceGroup: "",
  projectKey: "",
  tags: [],
  roles: [],
  dependentPermissions: [],
  isArchived: false,
  isBuiltIn: false,
  language: null,
  organizationIds: [],
  permissionSeverity: PermissionSeverityLevel.Low,
});

export const toPermissionStubs = (resources: string[]): IPermission[] =>
  resources.map(toPermissionStub);

export type IdentityProviderFormValues = {
  displayName: string;
  providerType: string;
  provider: string;
  clientId: string;
  clientSecret: string;
  wellKnownUrl?: string;
  audience?: string;
  /** A Microsoft entry's Entra tenant: a directory id or verified domain. Empty means "common". */
  tenant?: string;
};

const MICROSOFT_AUTHORITY = "https://login.microsoftonline.com/";
const MICROSOFT_DISCOVERY_PATH = "/v2.0/.well-known/openid-configuration";
const MICROSOFT_DEFAULT_TENANT = "common";

export const isMicrosoftSocial = (providerType?: string, provider?: string): boolean =>
  providerType === "social" && provider === "microsoft";

/** The discovery URL IAM reads a Microsoft entry's Entra tenant from. */
export const microsoftDiscoveryUrl = (tenant: string): string =>
  `${MICROSOFT_AUTHORITY}${tenant}${MICROSOFT_DISCOVERY_PATH}`;

/** The tenant a stored Microsoft discovery URL names; empty for "common" or any other URL. */
export const microsoftTenantOf = (wellKnownUrl?: string | null): string => {
  if (!wellKnownUrl?.startsWith(MICROSOFT_AUTHORITY) || !wellKnownUrl.endsWith(MICROSOFT_DISCOVERY_PATH)) {
    return "";
  }
  const tenant = wellKnownUrl.slice(MICROSOFT_AUTHORITY.length, -MICROSOFT_DISCOVERY_PATH.length);
  return tenant.includes("/") || tenant.toLowerCase() === MICROSOFT_DEFAULT_TENANT ? "" : tenant;
};

/** A directory id or domain: letters, digits, dots and hyphens. Empty is allowed. */
export const isValidMicrosoftTenant = (tenant: string): boolean => /^[A-Za-z0-9.-]*$/.test(tenant.trim());

/** True when another entry of the same provider already uses this display name. */
export const isDisplayNameTaken = (
  providers: IdentityProvider[],
  provider: string,
  displayName: string,
  editId?: string,
): boolean => {
  const name = displayName.trim().toLowerCase();
  return (
    !!name &&
    providers.some(
      (entry) =>
        entry.itemId !== editId &&
        entry.provider === provider &&
        (entry.displayName ?? "").trim().toLowerCase() === name,
    )
  );
};

/** The provider's own name as a first display name, unless another entry of it already has it. */
export const suggestDisplayName = (
  providers: IdentityProvider[],
  provider: string,
  label: string | undefined,
): string => (label && !isDisplayNameTaken(providers, provider, label) ? label : "");

const resolveWellKnownUrl = (
  providerType: string,
  provider: string,
  values: IdentityProviderFormValues,
  blocksOidcWellKnownUrl: string,
  editedProvider: IdentityProvider | undefined,
  isEditing: boolean,
): string => {
  if (providerType === "blocks-oidc") {
    return blocksOidcWellKnownUrl || values.wellKnownUrl || editedProvider?.wellKnownUrl || "";
  }
  if (isMicrosoftSocial(providerType, provider)) {
    const tenant = values.tenant?.trim() ?? "";
    if (tenant) return microsoftDiscoveryUrl(tenant);
    // Clearing the tenant moves a saved entry back to "common"; a new entry starts there anyway.
    return isEditing ? microsoftDiscoveryUrl(MICROSOFT_DEFAULT_TENANT) : "";
  }
  return values.wellKnownUrl || editedProvider?.wellKnownUrl || "";
};

export const deriveProtocol = (
  providerType: string,
  existingProtocol?: Protocol | null,
): Protocol => {
  if (existingProtocol) return existingProtocol;
  if (providerType === "saml") return "saml";
  return "oidc";
};

type BuildIdentityProviderPayloadArgs = {
  values: IdentityProviderFormValues;
  cleanedUris: string[];
  selectedRoles: IRole[];
  selectedPermissions: IPermission[];
  scopes: string[];
  requirePkce: boolean;
  blocksOidcWellKnownUrl: string;
  editedProvider?: IdentityProvider;
  editId?: string;
  isEditing: boolean;
};

export const buildIdentityProviderPayload = ({
  values,
  cleanedUris,
  selectedRoles,
  selectedPermissions,
  scopes,
  requirePkce,
  blocksOidcWellKnownUrl,
  editedProvider,
  editId,
  isEditing,
}: BuildIdentityProviderPayloadArgs): IdentityProvider => {
  const providerType = (values.providerType ||
    editedProvider?.providerType ||
    "social") as IdentityProviderType;
  const provider = values.provider || editedProvider?.provider || "";
  const clientId = values.clientId || editedProvider?.clientId || "";
  const protocol = deriveProtocol(providerType, editedProvider?.protocol);
  const wellKnownUrl = resolveWellKnownUrl(
    providerType,
    provider,
    values,
    blocksOidcWellKnownUrl,
    editedProvider,
    isEditing,
  );

  const sharedFields = {
    displayName: values.displayName.trim() || editedProvider?.displayName || provider,
    providerType,
    provider,
    protocol,
    clientId,
    audience: values.audience || editedProvider?.audience,
    wellKnownUrl,
    tokenEndpointAuthMethod: editedProvider?.tokenEndpointAuthMethod ?? "client_secret_basic",
    scope: scopes.length ? scopes.join(" ") : (editedProvider?.scope ?? "openid"),
    redirectUris: cleanedUris,
    requirePkce,
    initialRoles: selectedRoles.map((role) => role.slug),
    initialPermissions: selectedPermissions.map((permission) => permission.resource),
  };

  if (isEditing && editedProvider) {
    return {
      ...editedProvider,
      ...sharedFields,
      // The API never returns the stored secret. Empty keeps it; a typed value replaces it.
      clientSecret: values.clientSecret,
      isActive: editedProvider.isActive,
      itemId: editId ?? editedProvider.itemId,
    };
  }

  return {
    ...sharedFields,
    clientSecret: values.clientSecret,
    isActive: true,
  };
};

/**
 * The redirect URI the IAM login page sends when a user picks this social provider. IAM accepts it
 * only when it is in the provider's redirect URI list exactly, so the form shows it to copy.
 * Empty when any part is unknown.
 */
export const buildSocialLoginRedirectUri = (
  iamBaseUrl: string,
  provider: string,
  tenantId: string,
): string => {
  let base = iamBaseUrl.trim();
  while (base.endsWith("/")) base = base.slice(0, -1);
  if (!base || !provider || !tenantId) return "";
  return `${base}/oidc/${provider}/callback/${tenantId}`;
};

/** The IAM login redirect URI for a social provider; empty for every other provider type. */
export const getSocialLoginRedirectUri = (
  iamBaseUrl: string,
  providerType: string | undefined,
  provider: string | undefined,
  tenantId: string,
): string =>
  providerType === "social" ? buildSocialLoginRedirectUri(iamBaseUrl, provider ?? "", tenantId) : "";

/** True when the list holds the URI exactly (IAM compares case-sensitively, after trimming). */
export const hasRedirectUri = (uris: string[] | undefined, uri: string): boolean =>
  !!uri && (uris ?? []).some((u) => u.trim() === uri);

/** Adds the URI to the list, filling the first empty row instead of adding a new one. */
export const addRedirectUriToList = (uris: string[], uri: string): string[] => {
  if (hasRedirectUri(uris, uri)) return uris;
  const emptyIdx = uris.findIndex((u) => !u.trim());
  if (emptyIdx === -1) return [...uris, uri];
  return uris.map((u, i) => (i === emptyIdx ? uri : u));
};

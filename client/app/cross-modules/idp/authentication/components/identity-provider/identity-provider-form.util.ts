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
  const wellKnownUrl =
    providerType === "blocks-oidc"
      ? blocksOidcWellKnownUrl || values.wellKnownUrl || editedProvider?.wellKnownUrl || ""
      : values.wellKnownUrl || editedProvider?.wellKnownUrl || "";

  const sharedFields = {
    displayName: values.displayName || editedProvider?.displayName || provider,
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
      clientSecret: values.clientSecret || editedProvider.clientSecret,
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

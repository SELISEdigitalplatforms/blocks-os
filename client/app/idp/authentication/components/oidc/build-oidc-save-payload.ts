import {
  IOidcConfig,
  ISaveOidcCredentialPayload,
} from "@blocks-idp/authentication/models/auth.oidc.model";

type BrandingOverrides = {
  clientLogoUrl?: string;
  clientBrandColor?: string;
};

export const buildOidcSavePayload = (
  credential: IOidcConfig,
  projectKey: string,
  overrides: BrandingOverrides,
): ISaveOidcCredentialPayload => {
  const redirectUris =
    credential.redirectUris && credential.redirectUris.length
      ? credential.redirectUris
      : credential.redirectUri
        ? [credential.redirectUri]
        : [];

  return {
    audience: credential.audience ?? "",
    redirectUris,
    scope: credential.scope,
    isAutoRedirect: credential.isAutoRedirect,
    isActive: credential.isActive,
    requirePkce: credential.requirePkce,
    allowedResponseTypes:
      credential.allowedResponseTypes?.length > 0
        ? credential.allowedResponseTypes
        : ["code"],
    allowedServiceAccessResources: credential.allowedServiceAccessResources ?? [],
    itemId: credential.itemId,
    projectKey,
    clientDisplayName: credential.clientDisplayName,
    clientLogoUrl: overrides.clientLogoUrl,
    clientBrandColor: overrides.clientBrandColor,
  };
};

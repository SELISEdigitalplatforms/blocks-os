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
  overrides: BrandingOverrides,
): ISaveOidcCredentialPayload => {
  const redirectUris =
    credential.redirectUris && credential.redirectUris.length
      ? credential.redirectUris
      : credential.redirectUri
        ? [credential.redirectUri]
        : [];

  return {
    redirectUris,
    scope: credential.scope,
    isAutoRedirect: credential.isAutoRedirect,
    isActive: credential.isActive,
    requirePkce: credential.requirePkce,
    // A branding-only save must not silently unregister the identity provider.
    registerAsIdentityProvider: credential.registerAsIdentityProvider ?? false,
    allowedResponseTypes:
      credential.allowedResponseTypes?.length > 0 ? credential.allowedResponseTypes : ["code"],
    itemId: credential.itemId,
    clientDisplayName: credential.clientDisplayName,
    clientLogoUrl: overrides.clientLogoUrl,
    clientBrandColor: overrides.clientBrandColor,
  };
};

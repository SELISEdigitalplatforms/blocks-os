import { providers as providerCatalogue } from "@blocks-idp/authentication/constants/authentication.constant";

/** The catalogue ids the gallery has a card for; anything else lands on the custom card. */
export type ExternalIdpCardId = "keycloak" | "okta" | "auth0" | "azure" | "others";

export const PLATFORM_CARD_IDS: ExternalIdpCardId[] = ["keycloak", "okta", "auth0", "azure"];

/** Gallery copy for each external IdP card. `providerName` is the value the form stores. */
export const EXTERNAL_IDP_CARD_INFO: Record<
  ExternalIdpCardId,
  {
    providerName: string;
    label: string;
    description: string;
    tags: string[];
    /** Monochrome dark logos are inverted in dark mode so they stay visible on the tile. */
    darkInvert?: boolean;
  }
> = {
  keycloak: {
    providerName: "Keycloak",
    label: "Keycloak",
    description: "Open-source IAM, self-hosted or managed. Verify tokens issued by a realm.",
    tags: ["Realm JWKS", "Certificate"],
  },
  okta: {
    providerName: "Okta",
    label: "Okta",
    description: "Accept access tokens issued by an Okta authorization server.",
    tags: ["Authorization server", "JWKS"],
  },
  auth0: {
    providerName: "Auth0",
    label: "Auth0",
    description: "Accept access tokens Auth0 issues for your API audience.",
    tags: ["API audience", "JWKS"],
    darkInvert: true,
  },
  azure: {
    providerName: "Azure",
    label: "Azure",
    description: "Microsoft Entra ID (formerly Azure AD) tokens for your app registration.",
    tags: ["Entra ID", "JWKS"],
  },
  others: {
    providerName: "Others",
    label: "Custom issuer",
    description:
      "Any issuer that signs JWTs — your own auth service, Cognito, Firebase, a gateway.",
    tags: ["JWKS", "Certificate", "Shared secret"],
  },
};

export const externalIdpLogo = (id: ExternalIdpCardId) =>
  providerCatalogue.find((p) => p.id === id)?.icon || undefined;

/** Which card a stored provider belongs on, matched by name as the list used to match its icon. */
export const externalIdpCardId = (providerName: string): ExternalIdpCardId =>
  PLATFORM_CARD_IDS.find(
    (id) => EXTERNAL_IDP_CARD_INFO[id].providerName.toLowerCase() === providerName?.toLowerCase(),
  ) ?? "others";

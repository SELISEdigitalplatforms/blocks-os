export const UserCreationType: Record<number, string> = {
  0: "None",
  1: "Portal",
  2: "API",
  3: "Service",
  4: "Social",
};

/**
 * OAuth 2.0 grant types supported by the platform. The string values match
 * the values sent on the wire and stored in project configuration.
 */
export enum GRANT_TYPES {
  /** Resource Owner Password Credentials grant (username + password). */
  password = "password",
  /** Social / federated login (single sign-on via an external IdP). */
  social = "social",
  /** Client Credentials grant (machine-to-machine, no end user). */
  clientCredential = "client_credentials",
  /** Authorization Code grant with PKCE (standard OIDC web/mobile flow). */
  authorizationCode = "authorization_code",
}

export const GRANT_TYPES_OPTIONS: { id: GRANT_TYPES; label: string; value: string }[] = [
  {
    id: GRANT_TYPES.authorizationCode,
    label: "Authorization Code",
    value: GRANT_TYPES.authorizationCode,
  },
  {
    id: GRANT_TYPES.clientCredential,
    label: "Client Credential",
    value: GRANT_TYPES.clientCredential,
  },
];

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const AuthenticationTabs: { id: string; label: string; value: string }[] = [
//   { id: "oidc-template", label: "OIDC template", value: "oidc-template" },
//   { id: "roles", label: "Roles", value: "roles" },
//   { id: "permissions", label: "Permissions", value: "permissions" },
//   // {
//   //   id: GRANT_TYPES.clientCredential,
//   //   label: "Client Credential",
//   //   value: GRANT_TYPES.clientCredential,
//   // },
// ];

// DEADCODE 2026-07-29: no references in client or e2e; commented pending review
// export const SecretManagementTabs: { id: string; label: string; value: string }[] = [
//   {
//     id: "my-secret",
//     label: "My Secret",
//     value: "my-secret",
//   },
//   {
//     id: "managed-services",
//     label: "My Services",
//     value: "my-services",
//   },
//   {
//     id: GRANT_TYPES.authorizationCode,
//     label: "OIDC",
//     value: GRANT_TYPES.authorizationCode,
//   },
//   {
//     id: GRANT_TYPES.social,
//     label: "SSO",
//     value: GRANT_TYPES.social,
//   },
//   {
//     id: "external-idp",
//     label: "External IdP",
//     value: "external-idp",
//   },
//   {
//     id: "captcha",
//     label: "Captcha",
//     value: "captcha",
//   },
//   {
//     id: "mfa",
//     label: "MFA",
//     value: "mfa",
//   },
//   {
//     id: "magic-url",
//     label: "Magic URL",
//     value: "magic-url",
//   },
//   {
//     id: "storage",
//     label: "Storage",
//     value: "storage",
//   },
//   {
//     id: "email",
//     label: "Email",
//     value: "email",
//   },
//   {
//     id: "notification",
//     label: "Notification",
//     value: "notification",
//   },
//   {
//     id: "ai-models",
//     label: "AI Models",
//     value: "ai-models",
//   },
// ];

export const providers = [
  { id: "keycloak", name: "Keycloak", icon: "/assets/images/keycloak_icon.png" },
  { id: "okta", name: "Okta", icon: "/assets/images/okta_symbol.png" },
  { id: "auth0", name: "Auth0", icon: "/assets/images/auth0.png" },
  { id: "azure", name: "Azure", icon: "/assets/images/azure.png" },
  { id: "others", name: "Others", icon: "" },
];

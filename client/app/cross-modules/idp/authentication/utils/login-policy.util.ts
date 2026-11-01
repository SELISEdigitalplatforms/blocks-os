import type {
  IOidcClientLoginPolicy,
  ITenantLoginPolicy,
} from "@blocks-idp/authentication/models/login-policy.model";

export const DEFAULT_CLIENT_LOGIN_POLICY: IOidcClientLoginPolicy = {
  method: "default",
  providers: "default",
  selectedProviderIds: [],
};

export const LOGIN_POLICY_LOCKED_MESSAGE =
  "At least one place (Embedded or OIDC) and one method (Password or Social) must stay on.";

/** True when the project policy would leave nobody able to sign in. */
export const locksEveryone = (policy: ITenantLoginPolicy): boolean =>
  (!policy.allowEmbedded && !policy.allowOidc) || (!policy.allowPassword && !policy.allowSocial);

const pluralProviders = (count: number) => `${count} provider${count === 1 ? "" : "s"}`;

const methodLabel = (method: IOidcClientLoginPolicy["method"]) => {
  if (method === "password") return "Password only";
  if (method === "social") return "Social only";
  return "Password + Social";
};

/** The one-line summary shown on an OIDC app. Missing policy follows the project. */
export const describeClientLoginPolicy = (policy?: IOidcClientLoginPolicy | null): string => {
  if (!policy) return "Sign-in: Follow project";
  const label = methodLabel(policy.method);
  const selected = policy.method !== "password" && policy.providers === "selected";
  return selected
    ? `Sign-in: ${label} (${pluralProviders(policy.selectedProviderIds.length)})`
    : `Sign-in: ${label}`;
};

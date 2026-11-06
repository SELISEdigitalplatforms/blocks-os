import { tStatic } from "@seliseblocks/genesis-os";
import type {
  IOidcClientLoginPolicy,
  ITenantLoginPolicy,
} from "@blocks-idp/authentication/models/login-policy.model";

const I18N_MODULE = "os.idp.auth";

export const DEFAULT_CLIENT_LOGIN_POLICY: IOidcClientLoginPolicy = {
  method: "default",
  providers: "default",
  selectedProviderIds: [],
};

/** Translated when called; use this in new code. */
export const getLoginPolicyLockedMessage = () =>
  tStatic(I18N_MODULE, "LOGIN_POLICY_UTIL.LOCKED_MESSAGE");

/** True when the project policy would leave nobody able to sign in. */
export const locksEveryone = (policy: ITenantLoginPolicy): boolean =>
  (!policy.allowEmbedded && !policy.allowOidc) || (!policy.allowPassword && !policy.allowSocial);

const methodLabel = (method: IOidcClientLoginPolicy["method"]) => {
  if (method === "password") return tStatic(I18N_MODULE, "LOGIN_POLICY_UTIL.METHOD_PASSWORD");
  if (method === "social") return tStatic(I18N_MODULE, "LOGIN_POLICY_UTIL.METHOD_SOCIAL");
  return tStatic(I18N_MODULE, "LOGIN_POLICY_UTIL.METHOD_BOTH");
};

/** The one-line summary shown on an OIDC app. Missing policy follows the project. */
export const describeClientLoginPolicy = (policy?: IOidcClientLoginPolicy | null): string => {
  if (!policy) return tStatic(I18N_MODULE, "LOGIN_POLICY_UTIL.FOLLOW_PROJECT");
  const label = methodLabel(policy.method);
  const selected = policy.method !== "password" && policy.providers === "selected";
  return selected
    ? tStatic(I18N_MODULE, "LOGIN_POLICY_UTIL.SUMMARY_PROVIDERS", {
        method: label,
        count: policy.selectedProviderIds.length,
      })
    : tStatic(I18N_MODULE, "LOGIN_POLICY_UTIL.SUMMARY", { method: label });
};

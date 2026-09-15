import type { IGetAuthConfigResponse } from "@blocks-idp/authentication/models/auth-configuration.model";
import { canonicalizeGrantTypes } from "@blocks-idp/authentication/utils/grant-types.util";
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model";

type AuthConfigApiDict = Record<string, unknown>;

const readNumber = (raw: AuthConfigApiDict, ...keys: string[]): number => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "number") return value;
  }
  return 0;
};

const readString = (raw: AuthConfigApiDict, ...keys: string[]): string => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string") return value;
  }
  return "";
};

const readBoolean = (raw: AuthConfigApiDict, fallback: boolean, ...keys: string[]): boolean => {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
  }
  return fallback;
};

const readGrantTypes = (raw: AuthConfigApiDict): string[] => {
  for (const key of ["allowedGrantTypes", "AllowedGrantTypes"]) {
    const value = raw[key];
    if (!Array.isArray(value)) continue;
    const types = value.filter((item): item is string => typeof item === "string");
    return canonicalizeGrantTypes(types);
  }
  return [];
};

export const normalizeAuthConfigResponse = (
  response: IGetAuthConfigResponse | AuthConfigApiDict,
): ISettingsAuthConfig => {
  const raw = response as AuthConfigApiDict;

  return {
    itemId: readString(raw, "itemId", "ItemId"),
    allowedGrantTypes: readGrantTypes(raw),
    accessTokenValidForNumberMinutes: readNumber(
      raw,
      "accessTokenValidForNumberMinutes",
      "AccessTokenValidForNumberMinutes",
    ),
    refreshTokenValidForNumberMinutes: readNumber(
      raw,
      "refreshTokenValidForNumberMinutes",
      "RefreshTokenValidForNumberMinutes",
    ),
    absoluteRefreshTokenValidForNumberMinutes: readNumber(
      raw,
      "absoluteRefreshTokenValidForNumberMinutes",
      "AbsoluteRefreshTokenValidForNumberMinutes",
    ),
    rememberMeRefreshTokenValidForNumberMinutes: readNumber(
      raw,
      "rememberMeRefreshTokenValidForNumberMinutes",
      "RememberMeRefreshTokenValidForNumberMinutes",
    ),
    getNumberOfWrongAttemptsToLockTheAccount: readNumber(
      raw,
      "getNumberOfWrongAttemptsToLockTheAccount",
      "GetNumberOfWrongAttemptsToLockTheAccount",
    ),
    accountLockDurationInMinutes: readNumber(
      raw,
      "accountLockDurationInMinutes",
      "AccountLockDurationInMinutes",
    ),
    publicCertificatePath: readString(raw, "publicCertificatePath", "PublicCertificatePath"),
    accountActivationPath: readString(raw, "accountActivationPath", "AccountActivationPath"),
    accountVerificationPath: readString(raw, "accountVerificationPath", "AccountVerificationPath"),
    recoverAccountPath: readString(raw, "recoverAccountPath", "RecoverAccountPath"),
    isOidcEnabled: readBoolean(raw, false, "isOidcEnabled", "IsOidcEnabled"),
    accountActionBaseUrl: readString(raw, "accountActionBaseUrl", "AccountActionBaseUrl"),
    useAccountActionBaseUrlAsDefault: readBoolean(
      raw,
      true,
      "useAccountActionBaseUrlAsDefault",
      "UseAccountActionBaseUrlAsDefault",
    ),
    activationUrlLifetimeInMinutes: readNumber(
      raw,
      "activationUrlLifetimeInMinutes",
      "ActivationUrlLifetimeInMinutes",
    ),
    recoverAccountUrlLifetimeInMinutes: readNumber(
      raw,
      "recoverAccountUrlLifetimeInMinutes",
      "RecoverAccountUrlLifetimeInMinutes",
    ),
    logoutOnPasswordChange: readBoolean(
      raw,
      true,
      "logoutOnPasswordChange",
      "LogoutOnPasswordChange",
    ),
    passwordStrengthCheckerRegex: readString(
      raw,
      "passwordStrengthCheckerRegex",
      "PasswordStrengthCheckerRegex",
    ),
    collectPasswordOnActivation: readBoolean(
      raw,
      true,
      "collectPasswordOnActivation",
      "CollectPasswordOnActivation",
    ),
  };
};

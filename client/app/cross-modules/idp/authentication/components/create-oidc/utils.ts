import { z } from "zod";
import type { IOidcClientTokenLifetimes } from "@blocks-idp/authentication/models/auth.oidc.model";
import type { IOidcClientLoginPolicy } from "@blocks-idp/authentication/models/login-policy.model";
import { DEFAULT_CLIENT_LOGIN_POLICY } from "@blocks-idp/authentication/utils/login-policy.util";

const PUBLIC_TLD_PATTERN = /^([a-z0-9-]+\.)+[a-z]{2,}$/i;

const hasPublicHostname = (hostname: string) => {
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  return PUBLIC_TLD_PATTERN.test(hostname);
};

const httpsUrlRule = (val: string) => {
  try {
    const url = new URL(val);
    if (url.hash || url.search) return false;
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return url.protocol === "http:" || url.protocol === "https:";
    }
    if (!hasPublicHostname(url.hostname)) return false;
    return url.protocol === "https:";
  } catch {
    return false;
  }
};

export type ApplicationType = "web" | "mobile";

export const HTTPS_REDIRECT_URI_MESSAGE =
  "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.";
export const WEB_APP_SCHEME_REDIRECT_URI_MESSAGE =
  "Mobile app redirect URIs need the Mobile app application type.";
export const MOBILE_INVALID_REDIRECT_URI_MESSAGE =
  "Enter an HTTPS URL or a mobile app URI such as com.example.app://callback.";

const APP_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*$/;
const BLOCKED_APP_SCHEMES = new Set([
  "http",
  "https",
  "javascript",
  "data",
  "file",
  "vbscript",
  "blob",
  "about",
]);

/**
 * The app-scheme redirect URI rule from blocks-iam SPEC29 §6.1: the value parses as a URL, its
 * scheme (read from the raw value before the first ':') is a reverse-domain style scheme (contains a dot), it is not a browser or script
 * scheme, and it carries no fragment.
 */
export const isAppSchemeRedirectUri = (value: string) => {
  if (value.includes("#")) return false;
  const colon = value.indexOf(":");
  if (colon <= 0) return false;
  const scheme = value.slice(0, colon);
  if (!APP_SCHEME_PATTERN.test(scheme) || !scheme.includes(".")) return false;
  if (BLOCKED_APP_SCHEMES.has(scheme.toLowerCase())) return false;
  try {
    new URL(value);
  } catch {
    return false;
  }
  return true;
};

/**
 * Returns the validation message for a non-blank redirect URI entry under the selected
 * application type, or null when the entry is valid (spec 6.3).
 */
export const getRedirectUriError = (value: string, applicationType: ApplicationType) => {
  const isAppScheme = isAppSchemeRedirectUri(value);
  if (applicationType === "mobile") {
    return isAppScheme || httpsUrlRule(value) ? null : MOBILE_INVALID_REDIRECT_URI_MESSAGE;
  }
  if (isAppScheme) return WEB_APP_SCHEME_REDIRECT_URI_MESSAGE;
  return httpsUrlRule(value) ? null : HTTPS_REDIRECT_URI_MESSAGE;
};

const redirectUriEntry = z.object({
  value: z.string().trim(),
});

const buildRedirectUriSchema = (entryError: (value: string) => string | null) =>
  z
    .array(redirectUriEntry)
    .min(1, "At least one redirect URI is required")
    .superRefine((entries, ctx) => {
      entries.forEach((entry, idx) => {
        if (!entry.value) {
          ctx.addIssue({
            code: "custom",
            path: [idx, "value"],
            message: "Redirect URI is required",
          });
          return;
        }
        const message = entryError(entry.value);
        if (message) {
          ctx.addIssue({
            code: "custom",
            path: [idx, "value"],
            message,
          });
        }
      });
    });

/** Web-only redirect URI rule, kept as before for existing callers. */
export const redirectUriSubmitSchema = buildRedirectUriSchema((value) =>
  httpsUrlRule(value) ? null : HTTPS_REDIRECT_URI_MESSAGE,
);

const typedRedirectUriSchemas: Record<
  ApplicationType,
  ReturnType<typeof buildRedirectUriSchema>
> = {
  web: buildRedirectUriSchema((value) => getRedirectUriError(value, "web")),
  mobile: buildRedirectUriSchema((value) => getRedirectUriError(value, "mobile")),
};

/** Redirect URI rule for the selected application type (spec 6.3). */
export const getRedirectUriSchema = (applicationType: ApplicationType) =>
  typedRedirectUriSchemas[applicationType];

/**
 * Derives the application type of a stored client (spec 6.2): Mobile only for a non-device
 * client stored as public with tokens returned in the response body.
 */
export const deriveApplicationType = (credential: {
  clientType?: string | null;
  useTokensCookie?: boolean;
  isDeviceFlowClient?: boolean;
}): ApplicationType =>
  !credential.isDeviceFlowClient &&
  (credential.clientType ?? "").toLowerCase() === "public" &&
  credential.useTokensCookie === false
    ? "mobile"
    : "web";

/** Same bounds and messages as the server (blocks-iam SPEC5 6.2). */
export const TOKEN_LIFETIME_LIMITS = {
  access: { min: 1, max: 1440 },
  refresh: { min: 1, max: 525600 },
} as const;

export const TOKEN_LIFETIME_MESSAGES = {
  wholeNumber: "Enter a whole number of minutes.",
  access: "Access token lifetime must be between 1 and 1440 minutes.",
  refresh: "Refresh token idle lifetime must be between 1 and 525600 minutes.",
  absolute: "Refresh token maximum lifetime must be between 1 and 525600 minutes.",
  absoluteBelowRefresh:
    "Refresh token maximum lifetime must be at least the refresh token idle lifetime.",
} as const;

/** The three lifetime inputs as typed. An empty string means "use the project setting". */
export type TokenLifetimeFormValues = {
  accessTokenLifetime: string;
  refreshTokenLifetime: string;
  absoluteRefreshTokenLifetime: string;
};

export const EMPTY_TOKEN_LIFETIMES: TokenLifetimeFormValues = {
  accessTokenLifetime: "",
  refreshTokenLifetime: "",
  absoluteRefreshTokenLifetime: "",
};

const toInput = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value);

/** Maps the server's stored lifetimes (or their absence) to the form inputs. */
export const tokenLifetimesToForm = (
  lifetimes?: IOidcClientTokenLifetimes | null,
): TokenLifetimeFormValues => ({
  accessTokenLifetime: toInput(lifetimes?.accessTokenValidForNumberMinutes),
  refreshTokenLifetime: toInput(lifetimes?.refreshTokenValidForNumberMinutes),
  absoluteRefreshTokenLifetime: toInput(lifetimes?.absoluteRefreshTokenValidForNumberMinutes),
});

const WHOLE_NUMBER = /^\d+$/;

/** "" -> null, digits -> number, anything else -> NaN (flagged by the schema). */
const parseMinutes = (raw: string): number | null => {
  const value = raw.trim();
  if (value === "") return null;
  return WHOLE_NUMBER.test(value) ? Number(value) : Number.NaN;
};

const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1440;

const plural = (count: number, unit: string) => `${count} ${unit}${count === 1 ? "" : "s"}`;

/** 1440 -> "1 day", 90 -> "1 h 30 min", 45 -> "45 min". */
export const formatMinutes = (minutes: number): string => {
  if (minutes % MINUTES_PER_DAY === 0) return plural(minutes / MINUTES_PER_DAY, "day");
  if (minutes % MINUTES_PER_HOUR === 0) return plural(minutes / MINUTES_PER_HOUR, "hour");
  if (minutes > MINUTES_PER_HOUR) {
    return `${Math.floor(minutes / MINUTES_PER_HOUR)} h ${minutes % MINUTES_PER_HOUR} min`;
  }
  return `${minutes} min`;
};

/** A project value the UI can show: a positive number, else undefined (not loaded or unset). */
export const knownMinutes = (value: number | null | undefined): number | undefined =>
  typeof value === "number" && value > 0 ? value : undefined;

/**
 * The line under a lifetime input: what an empty input falls back to, or what a typed value
 * means in days/hours. Empty string for a value the schema rejects (its error is shown instead).
 */
export const describeTokenLifetime = (raw: string, projectMinutes?: number): string => {
  const project = projectMinutes === undefined ? undefined : formatMinutes(projectMinutes);
  const value = raw.trim();
  if (value === "") {
    return project ? `Uses project setting: ${project}.` : "Uses project setting.";
  }
  const minutes = Number(value);
  if (!WHOLE_NUMBER.test(value) || minutes < 1) return "";
  const own = `= ${formatMinutes(minutes)}`;
  return project ? `${own} · project: ${project}` : own;
};

/**
 * The save payload's `tokenLifetimes`, or undefined when no lifetime input changed — then the
 * property is left out and the server keeps the stored values.
 */
export const buildTokenLifetimesPayload = (
  current: TokenLifetimeFormValues,
  loaded: TokenLifetimeFormValues,
): IOidcClientTokenLifetimes | undefined => {
  const changed = (Object.keys(EMPTY_TOKEN_LIFETIMES) as (keyof TokenLifetimeFormValues)[]).some(
    (key) => current[key].trim() !== loaded[key].trim(),
  );
  if (!changed) return undefined;
  return {
    accessTokenValidForNumberMinutes: parseMinutes(current.accessTokenLifetime),
    refreshTokenValidForNumberMinutes: parseMinutes(current.refreshTokenLifetime),
    absoluteRefreshTokenValidForNumberMinutes: parseMinutes(current.absoluteRefreshTokenLifetime),
  };
};

const addTokenLifetimeIssues = (value: TokenLifetimeFormValues, ctx: z.RefinementCtx) => {
  const check = (
    key: keyof TokenLifetimeFormValues,
    limits: { min: number; max: number },
    rangeMessage: string,
  ): number | null => {
    const parsed = parseMinutes(value[key]);
    if (parsed === null) return null;
    if (Number.isNaN(parsed)) {
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: TOKEN_LIFETIME_MESSAGES.wholeNumber,
      });
      return null;
    }
    if (parsed < limits.min || parsed > limits.max) {
      ctx.addIssue({ code: "custom", path: [key], message: rangeMessage });
      return null;
    }
    return parsed;
  };

  check("accessTokenLifetime", TOKEN_LIFETIME_LIMITS.access, TOKEN_LIFETIME_MESSAGES.access);
  const refresh = check(
    "refreshTokenLifetime",
    TOKEN_LIFETIME_LIMITS.refresh,
    TOKEN_LIFETIME_MESSAGES.refresh,
  );
  const absolute = check(
    "absoluteRefreshTokenLifetime",
    TOKEN_LIFETIME_LIMITS.refresh,
    TOKEN_LIFETIME_MESSAGES.absolute,
  );
  if (refresh !== null && absolute !== null && absolute < refresh) {
    ctx.addIssue({
      code: "custom",
      path: ["absoluteRefreshTokenLifetime"],
      message: TOKEN_LIFETIME_MESSAGES.absoluteBelowRefresh,
    });
  }
};

export const SELECT_PROVIDER_MESSAGE = "Select at least one provider, or choose Default.";

/** The sign-in inputs as the form holds them. */
export type LoginPolicyFormValues = {
  loginMethod: IOidcClientLoginPolicy["method"];
  loginProviders: IOidcClientLoginPolicy["providers"];
  loginProviderIds: string[];
};

export const DEFAULT_LOGIN_POLICY_FORM: LoginPolicyFormValues = {
  loginMethod: "default",
  loginProviders: "default",
  loginProviderIds: [],
};

/** Maps the stored policy (null or absent = Default) to the form inputs. */
export const loginPolicyToForm = (policy?: IOidcClientLoginPolicy | null): LoginPolicyFormValues => {
  const source = policy ?? DEFAULT_CLIENT_LOGIN_POLICY;
  return {
    loginMethod: source.method,
    loginProviders: source.providers,
    loginProviderIds: [...source.selectedProviderIds],
  };
};

/** Social providers only matter when the method can use them. */
export const usesSocialProviders = (method: LoginPolicyFormValues["loginMethod"]) =>
  method !== "password";

/** The `loginPolicy` of the save payload. Providers are dropped when the method is Password. */
export const buildLoginPolicyPayload = (values: LoginPolicyFormValues): IOidcClientLoginPolicy => {
  const selected = usesSocialProviders(values.loginMethod) && values.loginProviders === "selected";
  return {
    method: values.loginMethod,
    providers: selected ? "selected" : "default",
    selectedProviderIds: selected ? values.loginProviderIds : [],
  };
};

/** Spread into the save payload: device-flow clients have no sign-in rule, so nothing is sent. */
export const buildLoginPolicyFields = (
  values: LoginPolicyFormValues & { isDeviceFlowClient: boolean },
): { loginPolicy?: IOidcClientLoginPolicy } =>
  values.isDeviceFlowClient ? {} : { loginPolicy: buildLoginPolicyPayload(values) };

const tokenLifetimeInputs = z.object({
  accessTokenLifetime: z.string(),
  refreshTokenLifetime: z.string(),
  absoluteRefreshTokenLifetime: z.string(),
});

export const createOidcSchema = z
  .object({
    redirectUris: redirectUriEntry.array(),
    scope: z.string().trim(),
    clientDisplayName: z.string().trim().min(1, "Client display name is required"),
    isAutoRedirect: z.boolean(),
    isActive: z.boolean(),
    requirePkce: z.boolean(),
    registerAsIdentityProvider: z.boolean(),
    isDeviceFlowClient: z.boolean(),
    allowedResponseTypes: z.array(z.string()),
    applicationType: z.enum(["web", "mobile"]),
    storedClientType: z.string().nullable(),
    storedUseTokensCookie: z.boolean(),
    loadedApplicationType: z.enum(["web", "mobile"]).nullable(),
    accessTokenLifetime: z.string(),
    refreshTokenLifetime: z.string(),
    absoluteRefreshTokenLifetime: z.string(),
    loadedTokenLifetimes: tokenLifetimeInputs,
    loginMethod: z.enum(["default", "password", "social"]),
    loginProviders: z.enum(["default", "selected"]),
    loginProviderIds: z.array(z.string()),
  })
  .superRefine((value, ctx) => {
    // Lifetimes apply to every client type, device flow included, so they are checked first.
    addTokenLifetimeIssues(value, ctx);

    if (value.isDeviceFlowClient) {
      return;
    }

    if (
      usesSocialProviders(value.loginMethod) &&
      value.loginProviders === "selected" &&
      value.loginProviderIds.length === 0
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["loginProviderIds"],
        message: SELECT_PROVIDER_MESSAGE,
      });
    }

    const redirectResult = getRedirectUriSchema(value.applicationType).safeParse(
      value.redirectUris,
    );
    if (!redirectResult.success) {
      redirectResult.error.issues.forEach((issue) => {
        ctx.addIssue({
          code: "custom",
          path: ["redirectUris", ...issue.path],
          message: issue.message,
        });
      });
    }

    if (value.allowedResponseTypes.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["allowedResponseTypes"],
        message: "At least one response type is required",
      });
    }
  });

export type CreateOIDCFormValues = z.infer<typeof createOidcSchema>;

export const createOIDCFormDefaultValue: CreateOIDCFormValues = {
  redirectUris: [{ value: "" }],
  scope: "openid",
  clientDisplayName: "",
  isAutoRedirect: false,
  isActive: true,
  requirePkce: true,
  registerAsIdentityProvider: true,
  isDeviceFlowClient: false,
  allowedResponseTypes: ["code"],
  applicationType: "web",
  storedClientType: null,
  storedUseTokensCookie: true,
  loadedApplicationType: null,
  ...EMPTY_TOKEN_LIFETIMES,
  loadedTokenLifetimes: EMPTY_TOKEN_LIFETIMES,
  ...DEFAULT_LOGIN_POLICY_FORM,
};

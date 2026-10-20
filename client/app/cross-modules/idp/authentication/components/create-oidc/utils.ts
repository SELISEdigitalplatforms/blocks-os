import { z } from "zod";

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
            code: z.ZodIssueCode.custom,
            path: [idx, "value"],
            message: "Redirect URI is required",
          });
          return;
        }
        const message = entryError(entry.value);
        if (message) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
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
  })
  .superRefine((value, ctx) => {
    if (value.isDeviceFlowClient) {
      return;
    }

    const redirectResult = getRedirectUriSchema(value.applicationType).safeParse(
      value.redirectUris,
    );
    if (!redirectResult.success) {
      redirectResult.error.issues.forEach((issue) => {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["redirectUris", ...issue.path],
          message: issue.message,
        });
      });
    }

    if (value.allowedResponseTypes.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
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
};

import { tStatic } from "@seliseblocks/genesis-os";
import { z } from "zod";
import { MAX_REDEMPTIONS_LIMIT } from "./max-redemptions";

const I18N_MODULE = "os.idp.signup-links";

const ts = (key: string) => ({ error: () => tStatic(I18N_MODULE, key) });
const lifetimeRange = ts("CONFIGURATION_FORM_SCHEMA.LIFETIME_RANGE");

const relativePath = z
  .string()
  .optional()
  .refine((value) => {
    if (!value) return true;
    if (!value.startsWith("/") || value.startsWith("//")) return false;
    const beforeSlash = value.slice(1).split("/")[0] ?? "";
    return !beforeSlash.includes(":");
  }, ts("CONFIGURATION_FORM_SCHEMA.FORWARDED_PATH_RELATIVE"));

const isAbsoluteHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * A join URL is absolute https with no query and no fragment: the one-time code is appended
 * as the fragment, and a query would let the composed link smuggle parameters into the
 * construct's join screen. Mirrors the server rule so a typo is caught before the round trip.
 */
const isValidJoinUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.search && !url.hash;
  } catch {
    return false;
  }
};

export const signupLinkConfigurationFormSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, ts("CONFIGURATION_FORM_SCHEMA.NAME_REQUIRED"))
      .max(100, ts("CONFIGURATION_FORM_SCHEMA.NAME_MAX")),
    description: z
      .string()
      .max(500, ts("CONFIGURATION_FORM_SCHEMA.DESCRIPTION_MAX"))
      .optional()
      .or(z.literal("")),
    mode: z.enum(["Oidc", "Embedded"], {
      error: (issue) =>
        issue.input === undefined
          ? tStatic(I18N_MODULE, "CONFIGURATION_FORM_SCHEMA.MODE_REQUIRED")
          : undefined,
    }),
    // Required in OIDC mode only — enforced in superRefine, because a field that is
    // mandatory in one mode and forbidden in the other cannot be expressed per-field.
    clientId: z.string().trim().optional().or(z.literal("")),
    redirectUri: z.string().trim().optional().or(z.literal("")),
    joinUrl: z.string().trim().optional().or(z.literal("")),
    defaultForwardedTo: relativePath,
    credentialMode: z.enum(["Passwordless", "PasswordRequired"], {
      error: (issue) =>
        issue.input === undefined
          ? tStatic(I18N_MODULE, "CONFIGURATION_FORM_SCHEMA.CREDENTIAL_MODE_REQUIRED")
          : undefined,
    }),
    // Defaulted rather than required: it is a preference, not an answer the author
    // has to give, and an omitted one should mean the recommended ending.
    signInAfterActivation: z.boolean().default(true),
    // Number.isInteger, not .int(): zod 4's .int() also rejects unsafe integers and skips the
    // superRefine below; zod 3's did neither.
    defaultLifetimeMinutes: z.coerce
      .number<number>(lifetimeRange)
      .refine(Number.isInteger, lifetimeRange)
      .min(5, lifetimeRange)
      .max(10080, lifetimeRange),
    // A string, not z.coerce.number(): Number("") is 0, which IAM reads as unlimited.
    // The regex rejects signs, decimals, letters and exponent notation.
    defaultMaxRedemptions: z
      .string()
      .trim()
      .regex(/^\d*$/, ts("CONFIGURATION_FORM_SCHEMA.MAX_REDEMPTIONS_FORMAT"))
      // Size is judged only for well-formed digits; anything else already has the message above.
      .refine(
        (value) => !/^\d+$/.test(value) || Number(value) <= MAX_REDEMPTIONS_LIMIT,
        ts("CONFIGURATION_FORM_SCHEMA.MAX_REDEMPTIONS_SIZE"),
      )
      .default(""),
    // Secure by default: on for new configurations and for legacy ones without a value.
    requireExistingUserPassword: z.boolean().default(true),
    defaultRoles: z.array(z.string()),
    defaultPermissions: z
      .array(z.string())
      .max(50, ts("CONFIGURATION_FORM_SCHEMA.PERMISSIONS_MAX")),
  })
  .superRefine((values, ctx) => {
    if (values.mode === "Oidc") {
      if (!values.clientId) {
        ctx.addIssue({
          code: "custom",
          path: ["clientId"],
          message: tStatic(I18N_MODULE, "CONFIGURATION_FORM_SCHEMA.CLIENT_REQUIRED"),
        });
      }

      if (!values.redirectUri) {
        ctx.addIssue({
          code: "custom",
          path: ["redirectUri"],
          message: tStatic(I18N_MODULE, "CONFIGURATION_FORM_SCHEMA.REDIRECT_URI_REQUIRED"),
        });
      } else if (!isAbsoluteHttpUrl(values.redirectUri)) {
        ctx.addIssue({
          code: "custom",
          path: ["redirectUri"],
          message: tStatic(I18N_MODULE, "CONFIGURATION_FORM_SCHEMA.REDIRECT_URI_ABSOLUTE"),
        });
      }

      return;
    }

    // Embedded. The server rejects a client or redirect outright, so the form must not be
    // able to send one — the fields are hidden, and this catches a stale value behind them.
    if (values.joinUrl && !isValidJoinUrl(values.joinUrl)) {
      ctx.addIssue({
        code: "custom",
        path: ["joinUrl"],
        message: tStatic(I18N_MODULE, "CONFIGURATION_FORM_SCHEMA.JOIN_URL_INVALID"),
      });
    }
  });

export type SignupLinkConfigurationFormValues = z.infer<typeof signupLinkConfigurationFormSchema>;

export const signupLinkConfigurationFormDefaults: SignupLinkConfigurationFormValues = {
  name: "",
  description: "",
  mode: "Oidc",
  clientId: "",
  redirectUri: "",
  joinUrl: "",
  defaultForwardedTo: "",
  credentialMode: "Passwordless",
  // On by default, so choosing PasswordRequired gives the invitee the better ending
  // without anyone having to know the option exists. Forced false while Passwordless,
  // where the server refuses it — see toModePayload.
  signInAfterActivation: true,
  defaultLifetimeMinutes: 1440,
  // Empty means IAM's default of a single use.
  defaultMaxRedemptions: "",
  requireExistingUserPassword: true,
  defaultRoles: [],
  defaultPermissions: [],
};

/**
 * Strips the fields the other mode forbids. The server rejects a client on an embedded
 * configuration and a join URL on an OIDC one, so a value left behind by switching the mode
 * mid-edit has to be dropped here rather than sent and bounced.
 */
export const toModePayload = <T extends Partial<SignupLinkConfigurationFormValues>>(
  values: T,
  mode: SignupLinkConfigurationFormValues["mode"],
): T => {
  const next = { ...values };
  if (mode === "Embedded") {
    delete next.clientId;
    delete next.redirectUri;
  } else {
    delete next.joinUrl;
  }

  // Passwordless never mints an activation key, so the server rejects the flag outright
  // rather than storing it inert. The form defaults it on, which would make every
  // Passwordless save a 400 if it were sent as-is.
  if (next.credentialMode !== undefined && next.credentialMode !== "PasswordRequired") {
    next.signInAfterActivation = false;
  }

  return next;
};

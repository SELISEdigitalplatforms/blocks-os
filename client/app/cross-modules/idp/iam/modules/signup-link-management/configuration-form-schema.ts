import { z } from "zod";

const relativePath = z
  .string()
  .optional()
  .refine(
    (value) => {
      if (!value) return true;
      if (!value.startsWith("/") || value.startsWith("//")) return false;
      const beforeSlash = value.slice(1).split("/")[0] ?? "";
      return !beforeSlash.includes(":");
    },
    { message: "Forwarded path must be a relative path starting with /" },
  );

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
      .min(1, "Name is required")
      .max(100, "Name must be 100 characters or fewer"),
    description: z
      .string()
      .max(500, "Description must be 500 characters or fewer")
      .optional()
      .or(z.literal("")),
    mode: z.enum(["Oidc", "Embedded"], {
      required_error: "Mode is required",
    }),
    // Required in OIDC mode only — enforced in superRefine, because a field that is
    // mandatory in one mode and forbidden in the other cannot be expressed per-field.
    clientId: z.string().trim().optional().or(z.literal("")),
    redirectUri: z.string().trim().optional().or(z.literal("")),
    joinUrl: z.string().trim().optional().or(z.literal("")),
    defaultForwardedTo: relativePath,
    credentialMode: z.enum(["Passwordless", "PasswordRequired"], {
      required_error: "Credential mode is required",
    }),
    // Defaulted rather than required: it is a preference, not an answer the author
    // has to give, and an omitted one should mean the recommended ending.
    signInAfterActivation: z.boolean().default(true),
    defaultLifetimeMinutes: z.coerce
      .number({ invalid_type_error: "Must be between 5 and 10080" })
      .int("Must be between 5 and 10080")
      .min(5, "Must be between 5 and 10080")
      .max(10080, "Must be between 5 and 10080"),
    defaultRoles: z.array(z.string()),
    defaultPermissions: z.array(z.string()).max(50, "At most 50 permissions"),
  })
  .superRefine((values, ctx) => {
    if (values.mode === "Oidc") {
      if (!values.clientId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["clientId"],
          message: "Client is required",
        });
      }

      if (!values.redirectUri) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["redirectUri"],
          message: "Redirect URI is required",
        });
      } else if (!isAbsoluteHttpUrl(values.redirectUri)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["redirectUri"],
          message: "Redirect URI must be an absolute URL",
        });
      }

      return;
    }

    // Embedded. The server rejects a client or redirect outright, so the form must not be
    // able to send one — the fields are hidden, and this catches a stale value behind them.
    if (values.joinUrl && !isValidJoinUrl(values.joinUrl)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["joinUrl"],
        message: "Join URL must be an absolute https URL with no query or fragment",
      });
    }
  });

export type SignupLinkConfigurationFormValues = z.infer<
  typeof signupLinkConfigurationFormSchema
>;

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

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

const redirectUriEntry = z.object({
  value: z.string().trim(),
});

export const redirectUriSubmitSchema = z
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
      if (!httpsUrlRule(entry.value)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [idx, "value"],
          message:
            "Enter a valid HTTPS URL with a public domain (e.g. https://example.com/callback). Localhost may use HTTP.",
        });
      }
    });
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
  })
  .superRefine((value, ctx) => {
    if (value.isDeviceFlowClient) {
      return;
    }

    const redirectResult = redirectUriSubmitSchema.safeParse(value.redirectUris);
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
};

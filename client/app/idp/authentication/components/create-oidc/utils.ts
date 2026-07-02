import { z } from "zod";

const redirectUriEntry = z.object({
  value: z.string().trim(),
});

const getRedirectUriError = (val: string): string | null => {
  try {
    const url = new URL(val);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return "Must be a valid HTTP or HTTPS URL";
    }
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return null;
    }
    if (url.protocol !== "https:") {
      return "Only HTTP is allowed for localhost. All other URLs must use HTTPS.";
    }
    return null;
  } catch {
    return "Must be a valid URL";
  }
};

const redirectUrisSchema = z
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
      const urlError = getRedirectUriError(entry.value);
      if (urlError) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [idx, "value"],
          message: urlError,
        });
      }
    });
  });

export const createOidcSchema = z.object({
  redirectUris: redirectUrisSchema,
  scope: z.string().trim(),
  clientBrandColor: z.string().optional(),
  clientDisplayName: z.string().trim().min(1, "Client display name is required"),
  isAutoRedirect: z.boolean(),
  isActive: z.boolean(),
  requirePkce: z.boolean(),
  allowedResponseTypes: z.array(z.string()).min(1, "At least one response type is required"),
});

export type CreateOIDCFormValues = z.infer<typeof createOidcSchema>;

export const createOIDCFormDefaultValue: CreateOIDCFormValues = {
  redirectUris: [{ value: "" }],
  scope: "openid",
  clientBrandColor: "#FFFFFF",
  clientDisplayName: "",
  isAutoRedirect: false,
  isActive: true,
  requirePkce: true,
  allowedResponseTypes: ["code"],
};

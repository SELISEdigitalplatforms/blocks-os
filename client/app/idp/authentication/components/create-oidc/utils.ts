import { z } from "zod";

const httpsUrlRule = (val: string) => {
  try {
    const url = new URL(val);
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
      return url.protocol === "http:" || url.protocol === "https:";
    }
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
          message: "Only HTTP is allowed for localhost. All other URLs must use HTTPS.",
        });
      }
    });
  });

export const createOidcSchema = z.object({
  redirectUris: redirectUriEntry
    .array()
    .min(1, "At least one redirect URI is required"),
  scope: z.string().trim(),
  clientBrandColor: z.string().optional(),
  clientDisplayName: z.string().trim().min(1, "Client display name is required"),
  isAutoRedirect: z.boolean(),
  isActive: z.boolean(),
  requirePkce: z.boolean(),
  allowedResponseTypes: z.array(z.string()).min(1, "At least one response type is required"),
  allowedServiceAccessResources: z
    .array(z.string())
    .min(1, "Select at least one allowed service"),
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
  allowedServiceAccessResources: [],
};

import { z } from "zod";

const httpsUrlSchema = z
  .string()
  .trim()
  .min(1, "Redirect URI is required")
  .refine((val) => {
    try {
      const url = new URL(val);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return url.protocol === "http:" || url.protocol === "https:";
      }
      return url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Only HTTP is allowed for localhost. All other URLs must use HTTPS.");

const redirectUriEntry = z.object({
  value: httpsUrlSchema,
});

export const createOidcSchema = z.object({
  redirectUris: z
    .array(redirectUriEntry)
    .min(1, "At least one redirect URI is required"),
  audienceUrlOidc: z.string().url("Must be a valid URL").refine((val) => {
    try {
      const url = new URL(val);
      if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
        return url.protocol === "http:" || url.protocol === "https:";
      }
      return url.protocol === "https:";
    } catch {
      return false;
    }
  }, "Only HTTP is allowed for localhost. All other URLs must use HTTPS."),
  scope: z.string().trim(),
  clientBrandColor: z.string().optional(),
  clientDisplayName: z.string().trim().min(1, "Client display name is required"),
  isAutoRedirect: z.boolean(),
  isActive: z.boolean(),
  requirePkce: z.boolean(),
  allowedResponseTypes: z.array(z.string()).min(1, "At least one response type is required"),
  allowedServiceAccessResources: z.array(z.string()),
});

export type CreateOIDCFormValues = z.infer<typeof createOidcSchema>;

export const createOIDCFormDefaultValue: CreateOIDCFormValues = {
  audienceUrlOidc: "",
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

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

export const signupLinkConfigurationFormSchema = z.object({
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
  clientId: z.string().trim().min(1, "Client is required"),
  redirectUri: z
    .string()
    .trim()
    .min(1, "Redirect URI is required")
    .refine((value) => {
      try {
        const url = new URL(value);
        return url.protocol === "http:" || url.protocol === "https:";
      } catch {
        return false;
      }
    }, "Redirect URI must be an absolute URL"),
  defaultForwardedTo: relativePath,
  credentialMode: z.enum(["Passwordless", "PasswordRequired"], {
    required_error: "Credential mode is required",
  }),
  defaultLifetimeMinutes: z.coerce
    .number({ invalid_type_error: "Must be between 5 and 10080" })
    .int("Must be between 5 and 10080")
    .min(5, "Must be between 5 and 10080")
    .max(10080, "Must be between 5 and 10080"),
  defaultRoles: z.array(z.string()),
  defaultPermissions: z
    .array(z.string())
    .max(50, "At most 50 permissions"),
});

export type SignupLinkConfigurationFormValues = z.infer<
  typeof signupLinkConfigurationFormSchema
>;

export const signupLinkConfigurationFormDefaults: SignupLinkConfigurationFormValues = {
  name: "",
  description: "",
  clientId: "",
  redirectUri: "",
  defaultForwardedTo: "",
  credentialMode: "Passwordless",
  defaultLifetimeMinutes: 1440,
  defaultRoles: [],
  defaultPermissions: [],
};

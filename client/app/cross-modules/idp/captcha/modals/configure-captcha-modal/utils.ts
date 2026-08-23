import { z } from "zod";

// The secret is required to create a configuration but optional to edit one — the backend
// never returns the existing secret, so an edit form can only ever offer to replace it, not
// require re-entering it every time.
export const buildConfigureCaptchaFormSchema = (isEditing: boolean) =>
  z.object({
    provider: z.enum(["recaptcha", "hcaptcha"], { required_error: "Captcha provider is required" }),
    captchaKey: z.string().min(1, "Site key is required"),
    captchaGenerator: z.string().min(1, "Generator type is required"),
    captchaSecret: isEditing
      ? z.string().optional()
      : z.string().min(1, "Secret key is required"),
  });

export type ConfigureCaptchaFormValues = z.infer<ReturnType<typeof buildConfigureCaptchaFormSchema>>;

export const ConfigureCaptchaFormDefaultValue: ConfigureCaptchaFormValues = {
  provider: "recaptcha",
  captchaKey: "",
  captchaGenerator: "EasyCaptchaGenerator",
  captchaSecret: "",
};

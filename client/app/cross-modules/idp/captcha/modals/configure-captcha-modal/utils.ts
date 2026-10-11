import { z } from "zod";
import { LINKED_SECRET_REPAIR_REQUIRED_MESSAGE } from "@/cross-modules/secrets/components/linked-secret-status/linked-secret-status";

// The secret is required to create a configuration but optional to edit one — the backend
// never returns the existing secret, so an edit form can only ever offer to replace it, not
// require re-entering it every time. The exception is a repair: when the linked secret is
// archived or missing there is nothing to keep, so an edit needs a new value too.
export const buildConfigureCaptchaFormSchema = (isEditing: boolean, needsNewSecret = false) =>
  z.object({
    provider: z.enum(["recaptcha", "hcaptcha"], { required_error: "Captcha provider is required" }),
    captchaKey: z.string().min(1, "Site key is required"),
    captchaGenerator: z.string().min(1, "Generator type is required"),
    captchaSecret: !isEditing
      ? z.string().min(1, "Secret key is required")
      : needsNewSecret
        ? z.string().min(1, LINKED_SECRET_REPAIR_REQUIRED_MESSAGE)
        : z.string().optional(),
  });

export type ConfigureCaptchaFormValues = z.infer<ReturnType<typeof buildConfigureCaptchaFormSchema>>;

export const ConfigureCaptchaFormDefaultValue: ConfigureCaptchaFormValues = {
  provider: "recaptcha",
  captchaKey: "",
  captchaGenerator: "EasyCaptchaGenerator",
  captchaSecret: "",
};

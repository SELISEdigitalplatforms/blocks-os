import { z } from "zod";
import { tStatic } from "@seliseblocks/genesis-os";
import { linkedSecretRepairRequiredMessage } from "@/cross-modules/secrets/components/linked-secret-status/linked-secret-status";

const I18N_MODULE = "os.idp.captcha";

// The secret is required to create a configuration but optional to edit one — the backend
// never returns the existing secret, so an edit form can only ever offer to replace it, not
// require re-entering it every time. The exception is a repair: when the linked secret is
// archived or missing there is nothing to keep, so an edit needs a new value too.
const captchaSecretSchema = (isEditing: boolean, needsNewSecret: boolean) => {
  if (!isEditing) {
    return z.string().min(1, tStatic(I18N_MODULE, "CONFIGURE_CAPTCHA_FORM.SECRET_REQUIRED"));
  }
  return needsNewSecret
    ? z.string().min(1, linkedSecretRepairRequiredMessage())
    : z.string().optional();
};

export const buildConfigureCaptchaFormSchema = (isEditing: boolean, needsNewSecret = false) =>
  z.object({
    provider: z.enum(["recaptcha", "hcaptcha"], {
      error: (issue) =>
        issue.input === undefined
          ? tStatic(I18N_MODULE, "CONFIGURE_CAPTCHA_FORM.PROVIDER_REQUIRED")
          : undefined,
    }),
    captchaKey: z.string().min(1, tStatic(I18N_MODULE, "CONFIGURE_CAPTCHA_FORM.SITE_KEY_REQUIRED")),
    captchaGenerator: z
      .string()
      .min(1, tStatic(I18N_MODULE, "CONFIGURE_CAPTCHA_FORM.GENERATOR_REQUIRED")),
    captchaSecret: captchaSecretSchema(isEditing, needsNewSecret),
  });

export type ConfigureCaptchaFormValues = z.infer<
  ReturnType<typeof buildConfigureCaptchaFormSchema>
>;

export const ConfigureCaptchaFormDefaultValue: ConfigureCaptchaFormValues = {
  provider: "recaptcha",
  captchaKey: "",
  captchaGenerator: "EasyCaptchaGenerator",
  captchaSecret: "",
};

import { z } from "zod";

export const ConfigureCaptchaFormSchema = z.object({
  secretName: z.string().min(1, "Name is required"),
  provider: z.enum(["recaptcha", "hcaptcha"]),
  captchaKey: z.string().min(1, "Site key is required"),
  captchaSecret: z.string().min(1, "Secret key is required"),
  captchaGenerator: z.string().min(1, "Generator type is required"),
});
export const ConfigureCaptchaFormDefaultValue = {
  secretName: "",
  provider: "",
  captchaKey: "",
  captchaSecret: "",
  captchaGenerator: "",
};

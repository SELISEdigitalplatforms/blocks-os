import { Input } from "@/components/ui-kits/input/input";
import { UseFormReturn } from "react-hook-form";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { ConfigureCaptchaFormValues } from "./utils";
import { Banner } from "@/components/ui-kits/banner/banner";
import type { BrokenLinkedSecretStatus } from "@/cross-modules/secrets/models/secret.model";
import { LINKED_SECRET_REPAIR_NOTICE } from "@/cross-modules/secrets/components/linked-secret-status/linked-secret-status";
import { useT } from "@seliseblocks/genesis-os";
type ConfigureGeneralCaptchaFormProps = {
  form: UseFormReturn<ConfigureCaptchaFormValues>;
  /** When true, the secret field is optional: leaving it blank keeps the existing secret. */
  isEditing: boolean;
  /**
   * Set when the linked secret is archived or missing: a notice explains why, the field is
   * required again even on edit, and a value repairs the configuration.
   */
  brokenStatus?: BrokenLinkedSecretStatus | null;
};
export const ConfigureGeneralCaptchaFormField = ({
  form,
  isEditing,
  brokenStatus = null,
}: ConfigureGeneralCaptchaFormProps) => {
  const { t } = useT("os.idp.captcha");
  const needsNewSecret = !!brokenStatus;
  const isRequired = !isEditing || needsNewSecret;
  const placeholder = needsNewSecret
    ? t("CONFIGURE_GENERAL_CAPTCHA_FORM_FIELD.PLACEHOLDER_NEW_SECRET")
    : isEditing
      ? t("CONFIGURE_GENERAL_CAPTCHA_FORM_FIELD.PLACEHOLDER_KEEP_SECRET")
      : t("CONFIGURE_GENERAL_CAPTCHA_FORM_FIELD.PLACEHOLDER_SECRET");
  return (
    <>
      <FormField
        name="captchaKey"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("CONFIGURE_GENERAL_CAPTCHA_FORM_FIELD.SITE_KEY")} <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder={t("CONFIGURE_GENERAL_CAPTCHA_FORM_FIELD.PLACEHOLDER_SITE_KEY")} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      {brokenStatus && (
        <Banner variant="warning" compact className="mb-0">
          {LINKED_SECRET_REPAIR_NOTICE[brokenStatus]}
        </Banner>
      )}
      <FormField
        name="captchaSecret"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              {t("CONFIGURE_GENERAL_CAPTCHA_FORM_FIELD.SECRET_KEY")} {isRequired && <span className="text-destructive">*</span>}
            </FormLabel>
            <FormControl>
              <Input placeholder={placeholder} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

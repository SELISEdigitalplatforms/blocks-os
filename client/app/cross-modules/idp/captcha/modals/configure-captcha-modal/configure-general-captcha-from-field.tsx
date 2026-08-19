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
type ConfigureGeneralCaptchaFormProps = {
  form: UseFormReturn<ConfigureCaptchaFormValues>;
  /** When true, the secret field is optional: leaving it blank keeps the existing secret. */
  isEditing: boolean;
};
export const ConfigureGeneralCaptchaFormField = ({
  form,
  isEditing,
}: ConfigureGeneralCaptchaFormProps) => {
  return (
    <>
      <FormField
        name="captchaKey"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Site key <span className="text-destructive">*</span>
            </FormLabel>
            <FormControl>
              <Input placeholder="Enter site key" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        name="captchaSecret"
        control={form.control}
        render={({ field }) => (
          <FormItem>
            <FormLabel>
              Secret key {!isEditing && <span className="text-destructive">*</span>}
            </FormLabel>
            <FormControl>
              <Input
                placeholder={isEditing ? "Leave blank to keep the current secret" : "Enter secret key"}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  );
};

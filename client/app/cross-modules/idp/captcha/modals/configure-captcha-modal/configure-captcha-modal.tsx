import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { CAPTCHA_PROVIDERS, ICaptchaConfig } from "../../models/captcha";
import { ConfigureGeneralCaptchaFormField } from "./configure-general-captcha-from-field";
import { ConfigureBlockCaptchaFormField } from "./configure-block-captcha-form-field";
import { useSaveCaptcha } from "../../hooks/use-captcha-config";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  buildConfigureCaptchaFormSchema,
  ConfigureCaptchaFormDefaultValue,
  ConfigureCaptchaFormValues,
} from "./utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { Button } from "@/components/ui-kits/button/button";
import { ReactNode, useState } from "react";
type ConfigureCaptchaModalProps = {
  configuration?: ICaptchaConfig | null;
  children: ReactNode;
};
export const ConfigureCaptchaModal = ({ configuration, children }: ConfigureCaptchaModalProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const isEditing = !!configuration;
  const defaultValues: ConfigureCaptchaFormValues = configuration
    ? {
        provider: configuration.provider,
        captchaKey: configuration.captchaKey,
        captchaGenerator: configuration.captchaGenerator,
        // Never pre-filled with the real secret — the backend does not return it.
        captchaSecret: "",
      }
    : ConfigureCaptchaFormDefaultValue;
  const form = useForm({
    defaultValues,
    resolver: zodResolver(buildConfigureCaptchaFormSchema(isEditing)),
    mode: "onChange",
  });
  const {
    formState: { isDirty, isValid },
  } = form;
  const { mutateAsync, isPending } = useSaveCaptcha();
  const onSubmitHandler = async (values: ConfigureCaptchaFormValues) => {
    try {
      await mutateAsync({
        isEnable: configuration ? configuration.isEnable : false,
        provider: values.provider,
        captchaKey: values.captchaKey,
        captchaGenerator: values.captchaGenerator,
        // Empty means "leave the existing secret untouched" — only send it when the caller
        // actually typed a new one.
        ...(values.captchaSecret ? { captchaSecret: values.captchaSecret } : {}),
      });
      showSuccessToast({
        description: configuration ? "Captcha updated successfully" : "Captcha added successfully",
      });
      form.reset();
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      }
    }
  };
  const ConfigureFormField = ConfigureGeneralCaptchaFormField;
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        form.reset(defaultValues);
        setOpen(value);
      }}
    >
      {children}
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>
            {configuration
              ? `Edit ${CAPTCHA_PROVIDERS[configuration.provider].label}`
              : "Add Captcha Configuration"}{" "}
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2">
          <Form {...form}>
            <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(onSubmitHandler)}>
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Captcha Provider <span className="text-destructive">*</span>
                    </FormLabel>
                    <FormControl>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger className="border-default col-span-3 flex h-10 w-full items-center justify-between rounded-md border bg-background px-3 py-2 text-sm shadow-none placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                          <SelectValue placeholder="Select configuration provider" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(CAPTCHA_PROVIDERS).map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ConfigureFormField form={form} isEditing={isEditing} />
              <ConfigureBlockCaptchaFormField form={form} />
              <DialogFooter className="mt-4">
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    Cancel
                  </Button>
                </DialogTrigger>
                <Button size="sm" disabled={isPending || !isDirty || !isValid} type="submit">
                  {isPending ? "Saving..." : configuration ? "Update Changes" : "Save"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
};

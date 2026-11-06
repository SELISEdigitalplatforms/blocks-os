import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Button } from "@/components/ui-kits/button/button";
import { DialogClose, DialogFooter } from "@/components/ui-kits/dialog/dialog";
import { useUpdateProject } from "@/hooks/use-project";
import type { IDomain } from "@/models/project.model";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  domainFormDefaultValues,
  createDomainFormSchema,
  type DomainFormSchema,
} from "./domain-form.schema";
import { DomainAction } from "./domain.constant";
import { showErrorToast, showSuccessToast } from "@seliseblocks/genesis-os/utils";
import { useT } from "@seliseblocks/genesis-os";

const getCookieDomain = (domain: string) => {
  try {
    const parts = new URL(`https://${domain}`).host.split(".");

    return parts.length > 2 ? parts.slice(1).join(".") : parts.join(".");
  } catch {
    return domain;
  }
};

interface DomainFormProps {
  /**
   * Pass an existing application to enter edit mode.
   * Omit (or pass null) for add mode.
   */
  application?: IDomain | null;
  onAfterSubmit: () => void;
}

export const DomainForm = ({ application, onAfterSubmit }: DomainFormProps) => {
  const { t } = useT("os.dashboard");
  const isEditMode = !!application;
  const { mutateAsync, isPending } = useUpdateProject();

  const form = useForm<DomainFormSchema>({
    resolver: zodResolver(createDomainFormSchema()),
    defaultValues: isEditMode
      ? {
          domain: application.domain.replace(/^https?:\/\//, ""),
          cookieDomain: application.cookieDomain,
        }
      : domainFormDefaultValues,
    mode: "onChange",
  });

  // formState.isValid lags behind autofill and programmatic setValue calls,
  // which left the submit button disabled with visibly valid values. Validate
  // the live values directly so the button always reflects what's on screen.
  const isFormValid = createDomainFormSchema().safeParse(form.watch()).success;

  const onSubmit = async (values: DomainFormSchema) => {
    try {
      const res = await mutateAsync({
        action: isEditMode ? DomainAction.Edit : DomainAction.Add,
        // Sends the original domain so the BE knows which record to update
        ...(isEditMode && { applicationDomain: application.domain }),
        application: {
          domain: `https://${values.domain}`,
          cookieDomain: values.cookieDomain,
          // Preserve existing verification status on edit; false on add
          isDomainVerified: isEditMode ? application.isDomainVerified : false,
        },
      });

      if (res.isSuccess) {
        showSuccessToast({
          description: isEditMode
            ? t("DOMAIN_FORM.APPLICATION_UPDATED_SUCCESSFULLY")
            : t("DOMAIN_FORM.APPLICATION_ADDED_SUCCESSFULLY"),
        });
        form.reset();
        onAfterSubmit();
      } else {
        showErrorToast({ errors: res.errors });
      }
    } catch (error) {
      if (error && typeof error === "object" && "errors" in error) {
        showErrorToast({
          errors: (error as { errors: unknown }).errors as string,
        });
      }
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm font-medium text-medium-emphasis">
                {t("DOMAIN_FORM.DOMAIN")}
              </FormLabel>
              <FormControl>
                <div className="flex items-center rounded-md border border-input bg-background px-3 py-2">
                  <span className="text-muted-foreground">{t("DOMAIN_FORM.HTTPS")}</span>
                  <Input
                    {...field}
                    placeholder={t("DOMAIN_FORM.YOUR_DOMAIN_COM")}
                    className="h-auto border-0 bg-transparent p-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                    onChange={(e) => {
                      field.onChange(e);
                      if (!form.formState.touchedFields.cookieDomain) {
                        // Without shouldValidate/shouldDirty the mirrored
                        // cookieDomain never re-validates, leaving isValid
                        // false (Add button disabled) even though both
                        // fields visibly hold valid values
                        form.setValue("cookieDomain", getCookieDomain(e.target.value), {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                      }
                    }}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="cookieDomain"
          render={({ field }) => (
            <FormItem className="space-y-1.5">
              <FormLabel className="text-sm font-medium text-medium-emphasis">
                {t("DOMAIN_FORM.COOKIE_DOMAIN")}
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder={t("DOMAIN_FORM.YOUR_DOMAIN_COM")} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter className="mt-2 flex flex-row justify-end gap-2">
          <DialogClose asChild>
            <Button variant="outline" size="sm" className="w-20">
              {t("common:CANCEL")}
            </Button>
          </DialogClose>
          <Button size="sm" className="w-20" type="submit" disabled={!isFormValid || isPending}>
            {isEditMode ? t("common:UPDATE") : t("common:ADD")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
};

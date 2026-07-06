import { Button } from "@/components/ui-kits/button/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui-kits/card/card";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import {
  showErrorToast,
  showSuccessToast,
} from "@seliseblocks/blocks-kit/utils";
import { isErrorWithErrors } from "@/lib/error";
import { GRANT_TYPES_OPTIONS } from "@blocks-idp/authentication/constants/authentication.constant";
import {
  canonicalizeGrantType,
  isGrantTypeSelected,
} from "@blocks-idp/authentication/utils/grant-types.util";
import { RequiredFieldLabel } from "@blocks-idp/settings/components/required-field-label";
import { useSaveSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config";
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model";
import {
  buildSavePayload,
  grantTypesFormSchema,
  type GrantTypesFormValues,
} from "@blocks-idp/settings/utils/auth-config-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

type CheckboxCheckedState = boolean | "indeterminate";

type SettingsGrantTypesCardProps = {
  config: ISettingsAuthConfig;
};

export const SettingsGrantTypesCard = ({
  config,
}: SettingsGrantTypesCardProps) => {
  const { mutateAsync, isPending } = useSaveSettingsAuthConfig();
  const form = useForm<GrantTypesFormValues>({
    defaultValues: { allowedGrantTypes: config.allowedGrantTypes },
    values: { allowedGrantTypes: config.allowedGrantTypes },
    resolver: zodResolver(grantTypesFormSchema),
  });

  const handleSubmit = async (values: GrantTypesFormValues) => {
    try {
      const payload = buildSavePayload(config, values);
      const res = await mutateAsync(payload);
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({ description: "Grant types updated successfully" });
      form.reset(values);
    } catch (error) {
      if (isErrorWithErrors(error))
        return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  const { isValid, isDirty } = form.formState;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <RequiredFieldLabel>Grant Types</RequiredFieldLabel>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="grid grid-cols-1 gap-4">
            {GRANT_TYPES_OPTIONS.map((item) => (
              <FormField
                key={item.id}
                control={form.control}
                name="allowedGrantTypes"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2">
                    <FormControl>
                      <Checkbox
                        checked={isGrantTypeSelected(field.value, item.value)}
                        onCheckedChange={(checked: CheckboxCheckedState) => {
                          const current = field.value ?? [];
                          const canonicalOption = canonicalizeGrantType(
                            item.value,
                          );
                          const withoutOption = current.filter(
                            (value) =>
                              canonicalizeGrantType(value) !== canonicalOption,
                          );
                          if (checked === true) {
                            field.onChange([...withoutOption, canonicalOption]);
                            return;
                          }
                          field.onChange(withoutOption);
                        }}
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">{item.label}</FormLabel>
                  </FormItem>
                )}
              />
            ))}
            <FormMessage />
            <div>
              <Button
                type="submit"
                disabled={isPending || !isValid || !isDirty}>
                Save
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

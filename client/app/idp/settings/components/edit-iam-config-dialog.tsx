import { PrimaryButton } from "@/components/action-buttons/primary-button";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import { Input } from "@/components/ui-kits/input/input";
import { Switch } from "@/components/ui-kits/switch/switch";
import {
  showErrorToast,
  showSuccessToast,
} from "@seliseblocks/blocks-kit/utils";
import { isErrorWithErrors } from "@/lib/error";
import { RequiredFieldLabel } from "@blocks-idp/settings/components/required-field-label";
import { useSaveSettingsAuthConfig } from "@blocks-idp/settings/hooks/use-settings-config";
import type { ISettingsAuthConfig } from "@blocks-idp/settings/models/settings.model";
import {
  buildSavePayload,
  iamConfigFormSchema,
  toIamConfigFormValues,
  type IamConfigFormValues,
} from "@blocks-idp/settings/utils/auth-config-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Pen } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

type EditIamConfigDialogProps = {
  config: ISettingsAuthConfig;
};

export const EditIamConfigDialog = ({ config }: EditIamConfigDialogProps) => {
  const [open, setOpen] = useState(false);
  const { mutateAsync, isPending } = useSaveSettingsAuthConfig();
  const form = useForm<IamConfigFormValues>({
    defaultValues: toIamConfigFormValues(config),
    resolver: zodResolver(iamConfigFormSchema),
  });

  const isOidcEnabled = form.watch("isOidcEnabled");
  const useAccountActionBaseUrlAsDefault = form.watch(
    "useAccountActionBaseUrlAsDefault",
  );
  const isAccountActionBaseUrlRequired =
    !isOidcEnabled && useAccountActionBaseUrlAsDefault;

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      form.reset(toIamConfigFormValues(config));
    }
    setOpen(isOpen);
  };

  const handleSubmit = async (values: IamConfigFormValues) => {
    try {
      const payload = buildSavePayload(config, values);
      const res = await mutateAsync(payload);
      if (!res.isSuccess) return showErrorToast({ errors: res.errors });
      showSuccessToast({
        description: "IAM configuration updated successfully",
      });
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error))
        return showErrorToast({ errors: error.errors });
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogTrigger asChild>
        <PrimaryButton label="Edit" Icon={Pen} />
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>IAM Config</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                name="accountActionBaseUrl"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>
                      <RequiredFieldLabel
                        required={isAccountActionBaseUrlRequired}>
                        Account Action Base URL
                      </RequiredFieldLabel>
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="accountActivationPath"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Activation Path</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="accountVerificationPath"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Account Verification Path</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="recoverAccountPath"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Recover Account Path</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="activationUrlLifetimeInMinutes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <RequiredFieldLabel>
                        Activation URL Lifetime (minutes)
                      </RequiredFieldLabel>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="recoverAccountUrlLifetimeInMinutes"
                control={form.control}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      <RequiredFieldLabel>
                        Recover Account URL Lifetime (minutes)
                      </RequiredFieldLabel>
                    </FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                name="useAccountActionBaseUrlAsDefault"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3 md:col-span-2">
                    <FormLabel>
                      Use Account Action Base URL as Default
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked: boolean) =>
                          field.onChange(checked)
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                name="logoutOnPasswordChange"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <FormLabel>Logout on Password Change</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked: boolean) =>
                          field.onChange(checked)
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                name="isOidcEnabled"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-md border p-3">
                    <FormLabel>OIDC Enabled</FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked: boolean) =>
                          field.onChange(checked)
                        }
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                name="passwordStrengthCheckerRegex"
                control={form.control}
                render={({ field }) => (
                  <FormItem className="md:col-span-2">
                    <FormLabel>Password Strength Regex</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex items-center justify-end gap-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="submit"
                disabled={isPending || !form.formState.isDirty}>
                Save
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

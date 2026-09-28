import { useEffect, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui-kits/button/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui-kits/dialog/dialog";
import { Form } from "@/components/ui-kits/form/form";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import { useUpdateSignupLinkConfiguration } from "@blocks-idp/iam/hooks/use-signup-link-configurations";
import { ISignupLinkConfiguration } from "@blocks-idp/iam/models/signup-link-configuration";
import { useQueryClient } from "@tanstack/react-query";
import { ConfigurationFormFields } from "../configuration-form-fields";
import {
  signupLinkConfigurationFormSchema,
  SignupLinkConfigurationFormValues,
} from "../configuration-form-schema";
import { applyServerFieldErrors } from "../apply-server-field-errors";

type UpdateConfigurationProps = {
  configuration: ISignupLinkConfiguration;
  isOpen: boolean;
  onClose: () => void;
};

const toFormValues = (
  configuration: ISignupLinkConfiguration,
): SignupLinkConfigurationFormValues => ({
  name: configuration.name,
  description: configuration.description ?? "",
  clientId: configuration.clientId,
  redirectUri: configuration.redirectUri,
  defaultForwardedTo: configuration.defaultForwardedTo ?? "",
  credentialMode: configuration.credentialMode,
  defaultLifetimeMinutes: configuration.defaultLifetimeMinutes,
  defaultRoles: configuration.defaultRoles ?? [],
  defaultPermissions: configuration.defaultPermissions ?? [],
});

export const UpdateConfiguration = ({
  configuration,
  isOpen,
  onClose,
}: UpdateConfigurationProps) => {
  const [formLevelError, setFormLevelError] = useState<string | null>(null);
  const { mutateAsync, isPending } = useUpdateSignupLinkConfiguration();
  const queryClient = useQueryClient();
  const form = useForm<SignupLinkConfigurationFormValues>({
    defaultValues: toFormValues(configuration),
    resolver: zodResolver(signupLinkConfigurationFormSchema),
  });
  const {
    formState: { isDirty, dirtyFields },
  } = form;

  useEffect(() => {
    if (isOpen) {
      form.reset(toFormValues(configuration));
      setFormLevelError(null);
    }
  }, [configuration, form, isOpen]);

  const onSubmit: SubmitHandler<SignupLinkConfigurationFormValues> = async (data) => {
    setFormLevelError(null);
    // PATCH only changed fields (H4).
    const patch: Record<string, unknown> = { itemId: configuration.itemId };
    (Object.keys(dirtyFields) as (keyof SignupLinkConfigurationFormValues)[]).forEach((key) => {
      const value = data[key];
      if (key === "description" && value === "") {
        patch.description = "";
        return;
      }
      if (key === "defaultForwardedTo" && value === "") {
        patch.defaultForwardedTo = "";
        return;
      }
      patch[key] = value;
    });

    try {
      const response = await mutateAsync(
        patch as Parameters<typeof mutateAsync>[0],
      );
      if (response?.isSuccess === false && response.errors) {
        const { formLevelError: level } = applyServerFieldErrors(form, response.errors);
        setFormLevelError(level);
        return;
      }
      showSuccessToast({ description: "Configuration updated" });
      onClose();
    } catch (error: unknown) {
      if (isHttpErrorStatus(error, 404)) {
        showErrorToast({ errors: "This configuration no longer exists." });
        void queryClient.invalidateQueries({ queryKey: ["signup-link-configurations"] });
        onClose();
        return;
      }
      if (
        error &&
        typeof error === "object" &&
        "status" in error &&
        (error as { status: number }).status === 400 &&
        "errors" in error
      ) {
        const httpError = error as { errors: Record<string, string | string[]> };
        const { formLevelError: level } = applyServerFieldErrors(form, httpError.errors);
        setFormLevelError(level);
        return;
      }
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
      <DialogHeader className="mb-4">
        <DialogTitle>Update Configuration</DialogTitle>
        <DialogDescription>Edit the signup link configuration.</DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <ConfigurationFormFields form={form} formLevelError={formLevelError} />
          <DialogFooter className="mt-6">
            <Button
              type="button"
              className="min-w-[80px]"
              variant="outline"
              disabled={isPending}
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button className="min-w-[80px]" type="submit" disabled={isPending || !isDirty}>
              {isPending ? "Updating…" : "Update"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
};

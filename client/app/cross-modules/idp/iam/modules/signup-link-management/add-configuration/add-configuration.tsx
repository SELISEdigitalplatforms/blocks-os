import { useState } from "react";
import { useForm, SubmitHandler, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui-kits/button/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui-kits/dialog/dialog";
import { Form } from "@/components/ui-kits/form/form";
import { PrimaryButton } from "@/components/action-buttons/primary-button";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isAccessGrantRefused } from "@/lib/error";
import { isHttpErrorStatus } from "@/lib/http/http-error.util";
import { useCreateSignupLinkConfiguration } from "@blocks-idp/iam/hooks/use-signup-link-configurations";
import { useT } from "@seliseblocks/genesis-os";
import { useQueryClient } from "@tanstack/react-query";
import { ConfigurationFormFields } from "../configuration-form-fields";
import {
  signupLinkConfigurationFormDefaults,
  signupLinkConfigurationFormSchema,
  SignupLinkConfigurationFormValues,
  toModePayload,
} from "../configuration-form-schema";
import { applyServerFieldErrors } from "../apply-server-field-errors";
import { toCreateMaxRedemptions } from "../max-redemptions";

type AddConfigurationProps = {
  /** When true, render only the trigger styling used inside the empty state. */
  triggerLabel?: string;
};

export const AddConfiguration = ({ triggerLabel }: AddConfigurationProps) => {
  const { t } = useT("os.idp.signup-links");
  const [open, setOpen] = useState(false);
  const [formLevelError, setFormLevelError] = useState<string | null>(null);
  const { mutateAsync, isPending, reset: resetMutation } = useCreateSignupLinkConfiguration();
  const queryClient = useQueryClient();
  const form = useForm<SignupLinkConfigurationFormValues>({
    defaultValues: signupLinkConfigurationFormDefaults,
    resolver: zodResolver(
      signupLinkConfigurationFormSchema,
    ) as Resolver<SignupLinkConfigurationFormValues>,
  });

  const close = () => {
    setOpen(false);
    form.reset(signupLinkConfigurationFormDefaults);
    setFormLevelError(null);
    resetMutation();
  };

  const onSubmit: SubmitHandler<SignupLinkConfigurationFormValues> = async (data) => {
    setFormLevelError(null);
    const lifetime =
      data.defaultLifetimeMinutes === undefined ||
      data.defaultLifetimeMinutes === null ||
      Number.isNaN(data.defaultLifetimeMinutes)
        ? 1440
        : data.defaultLifetimeMinutes;
    // toModePayload drops the fields the chosen mode forbids, so a value left behind by
    // switching the mode mid-edit is never sent and bounced by the server.
    const payload = {
      ...toModePayload(
        {
          name: data.name,
          description: data.description || undefined,
          defaultRoles: data.defaultRoles,
          defaultPermissions: data.defaultPermissions,
          mode: data.mode,
          clientId: data.clientId,
          redirectUri: data.redirectUri,
          joinUrl: data.joinUrl || undefined,
          defaultForwardedTo: data.defaultForwardedTo || undefined,
          credentialMode: data.credentialMode,
          defaultLifetimeMinutes: lifetime,
          // Sent in every mode so the stored value is always explicit; toModePayload keeps it.
          requireExistingUserPassword: data.requireExistingUserPassword,
        },
        data.mode,
      ),
      // Empty sends null (IAM default, single use), never 0, which would mean unlimited.
      defaultMaxRedemptions: toCreateMaxRedemptions(data.defaultMaxRedemptions),
    };
    try {
      const response = await mutateAsync(payload);
      if (response?.isSuccess === false && response.errors) {
        const { formLevelError: level } = applyServerFieldErrors(form, response.errors);
        setFormLevelError(level);
        return;
      }
      showSuccessToast({ description: t("ADD_CONFIGURATION.CREATED_TOAST") });
      close();
    } catch (error: unknown) {
      if (isAccessGrantRefused(error)) {
        showErrorToast({ errors: (error as { errors: unknown }).errors });
        return;
      }
      if (isHttpErrorStatus(error, 403)) {
        // Screen-level 403 is handled by the list; keep dialog quiet (C3).
        return;
      }
      if (isHttpErrorStatus(error, 404)) {
        showErrorToast({ errors: t("ADD_CONFIGURATION.NOT_FOUND") });
        void queryClient.invalidateQueries({ queryKey: ["signup-link-configurations"] });
        close();
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
      showErrorToast({ errors: t("ADD_CONFIGURATION.GENERIC_ERROR") });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          close();
          return;
        }
        setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <PrimaryButton label={triggerLabel ?? t("ADD_CONFIGURATION.TITLE")} />
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="mb-4">
          <DialogTitle>{t("ADD_CONFIGURATION.TITLE")}</DialogTitle>
          <DialogDescription>{t("ADD_CONFIGURATION.DESCRIPTION")}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <ConfigurationFormFields
              form={form}
              formLevelError={formLevelError}
              isPending={isPending}
            />
            <DialogFooter className="mt-6">
              <Button
                type="button"
                className="min-w-[80px]"
                variant="outline"
                disabled={isPending}
                onClick={close}
              >
                {t("common:CANCEL")}
              </Button>
              <Button className="min-w-[80px]" type="submit" disabled={isPending}>
                {isPending ? t("ADD_CONFIGURATION.CREATING") : t("common:CREATE")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

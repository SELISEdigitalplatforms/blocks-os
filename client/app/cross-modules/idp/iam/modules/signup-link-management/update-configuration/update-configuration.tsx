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
import { fromConfigurationMaxRedemptions, toEditMaxRedemptions } from "../max-redemptions";

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
  mode: configuration.mode ?? "Oidc",
  clientId: configuration.clientId,
  redirectUri: configuration.redirectUri,
  joinUrl: configuration.joinUrl ?? "",
  defaultForwardedTo: configuration.defaultForwardedTo ?? "",
  credentialMode: configuration.credentialMode,
  signInAfterActivation: configuration.signInAfterActivation ?? false,
  defaultLifetimeMinutes: configuration.defaultLifetimeMinutes,
  defaultMaxRedemptions: fromConfigurationMaxRedemptions(configuration.defaultMaxRedemptions),
  // A response from before the field existed, or a legacy document, reads as on.
  requireExistingUserPassword: configuration.requireExistingUserPassword ?? true,
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

  // A new configuration (or reopening) clears the previous form-level error. Done while
  // rendering rather than in the effect, so it does not cost an extra render pass.
  const openedFor = isOpen ? configuration : null;
  const [lastOpenedFor, setLastOpenedFor] = useState(openedFor);
  if (lastOpenedFor !== openedFor) {
    setLastOpenedFor(openedFor);
    if (openedFor) setFormLevelError(null);
  }

  useEffect(() => {
    if (isOpen) form.reset(toFormValues(configuration));
  }, [configuration, form, isOpen]);

  const onSubmit: SubmitHandler<SignupLinkConfigurationFormValues> = async (data) => {
    setFormLevelError(null);
    // PATCH only changed fields (H4).
    // Mode rides along whenever anything else changed: the server validates client,
    // redirect and joinUrl against the mode the document ends up in, so a PATCH that omits
    // it would be judged against the stored one.
    const patch: Record<string, unknown> = { itemId: configuration.itemId, mode: data.mode };
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
      if (key === "defaultMaxRedemptions") {
        // IAM ignores null on PATCH, so a cleared field sends 1 (what null resolves to).
        patch.defaultMaxRedemptions = toEditMaxRedemptions(data.defaultMaxRedemptions);
        return;
      }
      patch[key] = value;
    });

    // Always sent, touched or not, so every saved configuration stores an explicit value.
    patch.requireExistingUserPassword = data.requireExistingUserPassword;

    if (data.mode === "Embedded") {
      delete patch.clientId;
      delete patch.redirectUri;
    } else {
      delete patch.joinUrl;
    }

    // Only when the credential mode itself moved away from PasswordRequired. The server
    // validates the flag against the mode the document ends up in, so a stored true left
    // behind by that switch would be rejected — and the field is hidden by then, so the
    // author would have no way to see why. Unrelated edits stay out of it.
    if (dirtyFields.credentialMode && data.credentialMode !== "PasswordRequired") {
      patch.signInAfterActivation = false;
    }

    try {
      const response = await mutateAsync(patch as Parameters<typeof mutateAsync>[0]);
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

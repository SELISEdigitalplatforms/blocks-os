import { useEffect, useMemo, useState } from "react";
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
import { Input } from "@/components/ui-kits/input/input";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui-kits/form/form";
import {
  useAddUser,
  useCheckUserExists,
  useUpdateUserAccessControl,
} from "@blocks-idp/iam/hooks/use-user";
import {
  useGetOrganizationConfig,
  useGetOrganizations,
} from "@blocks-idp/iam/hooks/use-organization";
import { z } from "zod";
import { tStatic, useProjectStore, useT } from "@seliseblocks/genesis-os";
import { Check, CircleCheck, Loader, Plus } from "lucide-react";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { OrganizationCombobox } from "@blocks-idp/iam/components/organization-combobox";
import { NotifyUserCheckbox } from "@blocks-idp/iam/components/notify-user-checkbox";

const I18N_MODULE = "os.idp.organizations";

const DEFAULT_ORGANIZATION_ID = "default";

const inviteOrganizationUserFormDefaultValue = {
  email: "",
};

const inviteOrganizationUserFormSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, {
      error: () => tStatic(I18N_MODULE, "INVITE_ORGANIZATION_USER.EMAIL_REQUIRED"),
    })
    .check(
      z.email({
        error: () => tStatic(I18N_MODULE, "INVITE_ORGANIZATION_USER.EMAIL_INVALID"),
      }),
    ),
});

type InviteFormValues = z.infer<typeof inviteOrganizationUserFormSchema>;

interface InviteOrganizationUserProps {
  organizationId: string;
  organizationName?: string;
}

const extractFirstErrorMessage = (errors: unknown, fallback: string): string => {
  if (!errors) return fallback;
  if (typeof errors === "string") return errors;
  if (Array.isArray(errors)) return (errors[0] as string) || fallback;
  if (typeof errors === "object") {
    const first = Object.values(errors as Record<string, string>)[0];
    return first || fallback;
  }
  return fallback;
};

export const InviteOrganizationUser = ({
  organizationId,
  organizationName,
}: InviteOrganizationUserProps) => {
  const { t } = useT(I18N_MODULE);
  const { isPending: isCreatingUser, mutateAsync: createUser } = useAddUser();
  const queryClient = useQueryClient();

  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [open, setOpen] = useState(false);
  const [selectedOrgId, setSelectedOrgId] = useState(organizationId);
  const [notifyUser, setNotifyUser] = useState(true);

  const { data: orgsData } = useGetOrganizations({
    page: 0,
    pageSize: 10,
    projectKey: tenantId,
    enabled: open,
  });
  const { data: configData, isLoading: isConfigLoading } = useGetOrganizationConfig(tenantId);
  const isMultiOrgEnabled = configData?.isMultiOrgEnabled ?? true;

  // "Default" is an implicit organization every account belongs to. It is
  // never returned by the tenant organizations list, so it has to be added
  // in manually or it can never be selected.
  const hasNonDefaultOrgs = useMemo(
    () =>
      (orgsData?.organizations ?? []).some(
        (org) => org.isDisabled !== true && org.itemId !== DEFAULT_ORGANIZATION_ID,
      ) ||
      (orgsData?.totalCount ?? orgsData?.organizations?.length ?? 0) >
        (orgsData?.organizations?.length ?? 0),
    [orgsData?.organizations, orgsData?.totalCount],
  );

  const form = useForm<InviteFormValues>({
    defaultValues: inviteOrganizationUserFormDefaultValue,
    resolver: zodResolver(inviteOrganizationUserFormSchema),
    mode: "onChange",
  });

  const emailValue = form.watch("email") ?? "";
  const trimmedEmail = emailValue.trim();
  const isValidEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  // Debounce the value driving the existence check so it does not refire on
  // every keystroke. This also keeps the pending state visible long enough
  // to actually render instead of resolving within the same frame it started.
  const [debouncedEmail, setDebouncedEmail] = useState("");
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedEmail(trimmedEmail), 400);
    return () => clearTimeout(handle);
  }, [trimmedEmail]);
  const isEmailSettled = debouncedEmail === trimmedEmail;

  // Check whether the email already maps to a user. Drives which orgs to hide
  // from the picker, and the loading/found indicator shown inside the email field.
  const { data: existsData, isFetching: isFetchingExists } = useCheckUserExists(debouncedEmail, {
    enabled: isValidEmailFormat && isEmailSettled,
  });
  const isCheckingUserExists = isValidEmailFormat && (!isEmailSettled || isFetchingExists);
  const exists = Boolean(existsData?.userId);
  const existingUserOrgIds = useMemo(
    () => new Set(existsData?.organizationIds ?? []),
    [existsData?.organizationIds],
  );

  // When the email maps to an existing user, resolve their userId so we can
  // grant them access to the selected org instead of creating a new account.
  // The userId comes straight from the existence check response, no extra lookup needed.
  const existingUserId = existsData?.userId;
  const { mutateAsync: updateUserAccess, isPending: isGrantingAccess } = useUpdateUserAccessControl(
    {
      id: existingUserId ?? "",
      projectKey: tenantId,
    },
  );

  const isPending = isCreatingUser || isGrantingAccess;

  useEffect(() => {
    if (!open) {
      form.reset();
      setSelectedOrgId(organizationId);
      setNotifyUser(true);
      return;
    }
    // When multi-org is disabled we do not show an org picker, and the parent
    // org id is the only legitimate scope, so clear any prior selection.
    if (!isMultiOrgEnabled) {
      setSelectedOrgId("");
      return;
    }
    // When multi-org is enabled but the workspace has no real orgs, fall back
    // to the synthetic "default" so the user can submit against the implied
    // organization.
    if (orgsData && !hasNonDefaultOrgs) {
      setSelectedOrgId(DEFAULT_ORGANIZATION_ID);
    }
  }, [open, isMultiOrgEnabled, orgsData, hasNonDefaultOrgs, form, organizationId]);

  const isFormInvalid = !isValidEmailFormat || (exists && !existingUserId);
  const selectedOrganizationAlreadyAssigned =
    exists && !!selectedOrgId && existingUserOrgIds.has(selectedOrgId);

  const onSubmitHandler = async (values: InviteFormValues) => {
    try {
      if (exists) {
        if (!existingUserId) {
          showErrorToast({
            errors: t("INVITE_ORGANIZATION_USER.USER_NOT_FOUND"),
          });
          return;
        }
        const res = await updateUserAccess({
          organizationId: selectedOrgId,
          roles: [],
          permissions: [],
          notifyUser,
        });
        if (!res.isSuccess) {
          showErrorToast({
            errors: extractFirstErrorMessage(
              res.errors,
              t("INVITE_ORGANIZATION_USER.GRANT_FAILED"),
            ),
          });
          return;
        }
        showSuccessToast({ description: t("INVITE_ORGANIZATION_USER.GRANTED") });
        queryClient.invalidateQueries({ queryKey: ["organizations"] });
        queryClient.invalidateQueries({ queryKey: ["organization"] });
        form.reset();
        setOpen(false);
        return;
      }

      const res = await createUser({
        ...values,
        // Names are collected from the user on the activation form, not from the inviter.
        firstName: "",
        lastName: "",
        userPassType: 1,
        userCreationType: 1,
        platform: "blocks_portal",
        organizationId: selectedOrgId,
        notifyUser,
      });
      if (!res.isSuccess) {
        showErrorToast({
          errors: extractFirstErrorMessage(res.errors, t("INVITE_ORGANIZATION_USER.INVITE_FAILED")),
        });
        return;
      }
      showSuccessToast({ description: t("INVITE_ORGANIZATION_USER.INVITE_SENT") });
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      form.reset();
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: t("INVITE_ORGANIZATION_USER.SOMETHING_WENT_WRONG") });
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost" className="h-10 text-sm text-primary">
          <Plus className="h-5 w-5 md:mr-2.5" />
          <span className="sr-only sm:not-sr-only">{t("INVITE_ORGANIZATION_USER.TRIGGER")}</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[90vh] flex-col sm:max-w-[480px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{t("INVITE_ORGANIZATION_USER.TITLE")}</DialogTitle>
          <DialogDescription className="mt-2! text-sm text-medium-emphasis">
            {t("INVITE_ORGANIZATION_USER.DESCRIPTION")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmitHandler)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="-mx-1 flex-1 space-y-4 overflow-y-auto px-1 py-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common:EMAIL")}</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="email"
                          placeholder={t("INVITE_ORGANIZATION_USER.EMAIL_PLACEHOLDER")}
                          autoComplete="off"
                          className={cn(
                            isValidEmailFormat && (isCheckingUserExists || exists) && "pr-9",
                          )}
                          {...field}
                        />
                      </FormControl>
                      {isValidEmailFormat && isCheckingUserExists && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader className="h-4 w-4 animate-spin text-muted-foreground" />
                        </span>
                      )}
                      {isValidEmailFormat && !isCheckingUserExists && exists && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                          <Check className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </span>
                      )}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isValidEmailFormat && !isConfigLoading && isMultiOrgEnabled && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t("INVITE_ORGANIZATION_USER.ORGANIZATION_LABEL")}
                  </label>
                  <OrganizationCombobox
                    projectKey={tenantId}
                    value={selectedOrgId}
                    onValueChange={setSelectedOrgId}
                    preselectedOrganizationIds={existingUserOrgIds}
                    initialSelectedName={organizationName}
                    emptyMessage={
                      exists
                        ? t("INVITE_ORGANIZATION_USER.EMPTY_ALL_MEMBER")
                        : t("INVITE_ORGANIZATION_USER.EMPTY_NONE")
                    }
                  />
                  {selectedOrganizationAlreadyAssigned && (
                    <p
                      role="status"
                      className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400"
                    >
                      <CircleCheck className="h-3.5 w-3.5 shrink-0" />
                      {t("INVITE_ORGANIZATION_USER.ALREADY_ACCESS")}
                    </p>
                  )}
                </div>
              )}

              {/* A new account always gets its activation mail, so the choice only
                  applies when an existing user is being added to an organization. */}
              {exists && !selectedOrganizationAlreadyAssigned && (
                <NotifyUserCheckbox
                  checked={notifyUser}
                  onCheckedChange={setNotifyUser}
                  disabled={isPending}
                  description={t("INVITE_ORGANIZATION_USER.NOTIFY_DESCRIPTION")}
                />
              )}
            </div>
            <DialogFooter className="shrink-0 pt-4">
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  form.reset();
                  setOpen(false);
                }}
              >
                {t("common:CANCEL")}
              </Button>
              <Button
                type="submit"
                disabled={isPending || isFormInvalid || selectedOrganizationAlreadyAssigned}
              >
                {isPending && (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    {exists
                      ? t("INVITE_ORGANIZATION_USER.GRANTING")
                      : t("INVITE_ORGANIZATION_USER.SENDING")}
                  </>
                )}
                {!isPending &&
                  (exists
                    ? t("INVITE_ORGANIZATION_USER.GRANT_ACCESS")
                    : t("INVITE_ORGANIZATION_USER.SEND_INVITE"))}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

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
import {
  buildInviteUserFormSchema,
  inviteUserFormDefaultValue,
  inviteUserFormSchema,
} from "./utils";
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
import { z } from "zod";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useEffect, useMemo, useState } from "react";
import { Check, Loader } from "lucide-react";
import { isErrorWithErrors } from "@/lib/error";
import { PrimaryButton } from "@/components/action-buttons/primary-button";
import { cn } from "@/lib/utils";
import {
  useGetOrganizationConfig,
  useGetOrganizations,
} from "@blocks-idp/iam/hooks/use-organization";
import { OrganizationCombobox } from "@blocks-idp/iam/components/organization-combobox";

type InviteFormValues = z.infer<typeof inviteUserFormSchema>;

const DEFAULT_ORGANIZATION_ID = "default";

export const InviteUser = () => {
  const { isPending: isCreatingUser, mutateAsync: createUser } = useAddUser();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const [open, setOpen] = useState(false);

  const { data: orgsData } = useGetOrganizations({
    projectKey: tenantId,
    page: 0,
    pageSize: 10,
    enabled: open,
  });
  const { data: configData, isLoading: isConfigLoading } = useGetOrganizationConfig(tenantId);
  const isMultiOrgEnabled = configData?.isMultiOrgEnabled ?? true;

  const form = useForm<InviteFormValues>({
    defaultValues: inviteUserFormDefaultValue,
    resolver: zodResolver(buildInviteUserFormSchema(isMultiOrgEnabled)),
    mode: "onChange",
  });

  const emailValue = form.watch("email") ?? "";
  const trimmedEmail = emailValue.trim();
  const selectedOrgId = form.watch("organizationIds")?.[0] ?? "";
  const isValidEmailFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);

  // Debounce the value driving the existence check so it doesn't refire on
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
    { id: existingUserId ?? "", projectKey: tenantId },
  );

  const isPending = isCreatingUser || isGrantingAccess;

  // Treat a missing/undefined isDisabled as enabled. Only explicitly disabled
  // orgs (isDisabled === true) should be excluded from the picker.
  const enabledOrgs = useMemo(
    () => (orgsData?.organizations ?? []).filter((org) => org.isDisabled !== true),
    [orgsData?.organizations],
  );

  // "Default" is an implicit organization every account belongs to. It is
  // never returned by the tenant organizations list, so it has to be added
  // in manually or it can never be selected.
  const hasNonDefaultOrgs = useMemo(
    () =>
      enabledOrgs.some((org) => org.itemId !== DEFAULT_ORGANIZATION_ID) ||
      (orgsData?.totalCount ?? enabledOrgs.length) > (orgsData?.organizations?.length ?? 0),
    [enabledOrgs, orgsData?.organizations?.length, orgsData?.totalCount],
  );

  useEffect(() => {
    if (!open) {
      form.reset();
      return;
    }
    // When multi-org is disabled we don't show an org picker, and the server
    // implicitly assigns new users to the built-in "Default" org, so the form
    // payload stays empty.
    if (!isMultiOrgEnabled) {
      form.setValue("organizationIds", [], { shouldValidate: true });
      return;
    }
    // When multi-org is enabled but the workspace has no real orgs, seed the
    // selection with the synthetic "default" org so the user can submit
    // without having to pick from an empty list.
    if (!orgsData) return;
    if (!hasNonDefaultOrgs) {
      form.setValue("organizationIds", [DEFAULT_ORGANIZATION_ID], { shouldValidate: true });
    }
  }, [open, isMultiOrgEnabled, orgsData, hasNonDefaultOrgs, form]);

  // When multi-org is disabled the org picker is hidden, and we don't send
  // organizationId in the payload. The user is implicitly scoped to the
  // built-in "default" org on the server side.

  const onSubmitHandler = async (values: InviteFormValues) => {
    try {
      if (exists) {
        if (!existingUserId) {
          showErrorToast({
            errors: "Could not find this user's account. Please try again.",
          });
          return;
        }
        const res = await updateUserAccess({
          organizationId: isMultiOrgEnabled ? selectedOrgId : DEFAULT_ORGANIZATION_ID,
          roles: [],
          permissions: [],
        });
        if (!res.isSuccess) {
          const msg =
            res.errors && typeof res.errors === "object"
              ? (Object.values(res.errors as Record<string, string>)[0] ?? "Failed to grant access")
              : (res.errors as string) || "Failed to grant access";
          showErrorToast({ errors: msg });
          return;
        }
        showSuccessToast({ description: "User granted access to the organization" });
        form.reset();
        setOpen(false);
        return;
      }

      const { organizationIds: _organizationIds, ...restValues } = values;
      const res = await createUser({
        ...restValues,
        // Names are collected from the user on the activation form, not from the inviter.
        firstName: "",
        lastName: "",
        userPassType: 1,
        userCreationType: 1,
        platform: "blocks_portal",
        projectKey: tenantId,
        ...(isMultiOrgEnabled ? { organizationId: selectedOrgId } : {}),
      });
      if (!res.isSuccess) {
        const msg =
          res.errors && typeof res.errors === "object"
            ? (Object.values(res.errors as Record<string, string>)[0] ?? "Failed to invite user")
            : (res.errors as string) || "Failed to invite user";
        showErrorToast({ errors: msg });
        return;
      }
      showSuccessToast({ description: "Invitation is sent" });
      form.reset();
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: "Something went wrong" });
      }
    }
  };

  const isFormInvalid = !isValidEmailFormat || isConfigLoading || (exists && !existingUserId);

  // When multi-org is off, "grant access" is meaningless. There is no other
  // org to add the existing user to. Block submit and tell the user instead.
  const showExistingUserNotice = exists && !isMultiOrgEnabled;
  const selectedOrganizationAlreadyAssigned =
    exists && !!selectedOrgId && existingUserOrgIds.has(selectedOrgId);
  const isSubmitDisabled =
    isPending || isFormInvalid || showExistingUserNotice || selectedOrganizationAlreadyAssigned;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <PrimaryButton label="Invite User" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader className="mb-4">
          <DialogTitle>Invite User</DialogTitle>
          <DialogDescription className="!mt-2 text-sm text-medium-emphasis">
            Add a user to an organization.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmitHandler)}>
            <div className="flex flex-col gap-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <div className="relative">
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="name@company.com"
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

              {showExistingUserNotice && (
                <div
                  role="alert"
                  className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400"
                >
                  A user with this email already exists in the system.
                </div>
              )}

              {isValidEmailFormat && !isConfigLoading && isMultiOrgEnabled && (
                <FormField
                  control={form.control}
                  name="organizationIds"
                  render={() => (
                    <FormItem>
                      <FormLabel>Organization</FormLabel>
                      <OrganizationCombobox
                        projectKey={tenantId}
                        value={selectedOrgId}
                        onValueChange={(orgId) =>
                          form.setValue("organizationIds", [orgId], { shouldValidate: true })
                        }
                        preselectedOrganizationIds={existingUserOrgIds}
                        emptyMessage={
                          exists
                            ? "This user is already a member of all organizations"
                            : "No organizations available"
                        }
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="secondary"
                disabled={isPending}
                onClick={() => {
                  form.reset();
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitDisabled}>
                {isPending ? (
                  <>
                    <Loader className="mr-2 h-4 w-4 animate-spin" />
                    {exists ? "Granting access..." : "Sending..."}
                  </>
                ) : exists ? (
                  "Grant access"
                ) : (
                  "Send invite"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

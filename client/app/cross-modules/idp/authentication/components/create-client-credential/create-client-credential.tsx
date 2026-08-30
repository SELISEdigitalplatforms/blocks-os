import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Plus, KeyRound } from "lucide-react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useSaveAuthClient } from "@blocks-idp/authentication/hooks/use-auth-clients";
import { useForm } from "react-hook-form";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import {
  IClientCredentialsConfig,
  ISaveClientCredentialPayload,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import {
  CreateClientModalFormDefaultValues,
  CreateClientModalFormValues,
  createClientSchema,
} from "./utils";
import { isErrorWithErrors } from "@/lib/error";
import { ClientCredentialRolesSection } from "./client-credential-roles-section";
import { ClientCredentialPermissionsSection } from "./client-credential-permissions-section";

const MAX_PERMISSIONS = 10;

const getBackendErrorMap = (response: unknown) => {
  if (!response || typeof response !== "object") return undefined;

  const typedResponse = response as {
    errors?: unknown;
    error?: { errors?: unknown };
  };

  if (typedResponse.errors && typeof typedResponse.errors === "object") {
    return typedResponse.errors as Record<string, string | string[]>;
  }

  if (typedResponse.error?.errors && typeof typedResponse.error.errors === "object") {
    return typedResponse.error.errors as Record<string, string | string[]>;
  }

  return undefined;
};

type CreateClientCredentialProps = {
  editClient?: IClientCredentialsConfig | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  hideTrigger?: boolean;
};

export const CreateClientCredential = ({
  editClient,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger = false,
}: CreateClientCredentialProps) => {
  const [internalOpen, setInternalOpen] = useState<boolean>(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (v: boolean) => {
    if (!isControlled) setInternalOpen(v);
    controlledOnOpenChange?.(v);
  };

  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const isEdit = Boolean(editClient);

  const { mutateAsync: saveServiceClient, isPending } = useSaveAuthClient({
    projectKey: tenantId,
  });

  const form = useForm<CreateClientModalFormValues>({
    resolver: zodResolver(createClientSchema),
    defaultValues: CreateClientModalFormDefaultValues,
    mode: "onChange",
  });
  const {
    formState: { isDirty, isValid },
    reset,
    trigger,
  } = form;

  useEffect(() => {
    if (!open) return;
    if (editClient) {
      reset({
        itemId: editClient.itemId,
        clientNameService: editClient.name,
        accessTokenValidForNumberMinutes: editClient.accessTokenValidForNumberMinutes,
        isActive: editClient.isActive,
        roles: editClient.roles ?? [],
        permissions: editClient.permissions ?? [],
      });
    } else {
      reset(CreateClientModalFormDefaultValues);
    }
    // `reset` alone leaves `formState.isValid` stale (it only recomputes on the next
    // field-level change), so the submit button stays disabled until the user touches
    // an unrelated field. Force a validation pass against the just-reset values.
    void trigger();
  }, [editClient, open, reset, trigger]);

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      reset();
    }
    setOpen(isOpen);
  };

  const onSubmit = async (data: CreateClientModalFormValues) => {
    try {
      const payload: ISaveClientCredentialPayload = {
        itemId: data.itemId ?? null,
        name: data.clientNameService,
        isActive: data.isActive,
        accessTokenValidForNumberMinutes: data.accessTokenValidForNumberMinutes,
        roles: data.roles,
        permissions: data.permissions,
        projectKey: tenantId,
      };
      const res = await saveServiceClient(payload);
      if (!res?.isSuccess) {
        const apiErrors = getBackendErrorMap(res);
        return showErrorToast({
          errors: apiErrors ?? "Failed to save client credential.",
        });
      }
      showSuccessToast({
        description: isEdit
          ? "Client credential updated successfully"
          : "Client credential created successfully",
      });
      reset();
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      return showErrorToast({ errors: "Something went wrong" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      {!hideTrigger && (
        <DialogTrigger asChild>
          <Button size="sm">
            <Plus className="h-5 w-5" />
            <span className="sr-only sm:not-sr-only sm:ml-2.5 sm:text-sm sm:whitespace-nowrap">
              {isEdit ? "Edit Client Credential" : "Add"}
            </span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="max-w-2xl flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 px-6 pb-4 pt-6 pr-12">
          <DialogTitle>{isEdit ? "Edit Client Credential" : "Add Client Credential"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the credential name, lifetime, roles, and permissions."
              : "Create a credential and choose the roles and permissions it should grant."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 w-full min-w-0 flex-1 flex-col"
          >
            <div className="min-h-0 w-full min-w-0 flex-1 space-y-8 overflow-y-auto px-6 py-4">
              <section className="space-y-4">
              
                <FormField
                  control={form.control}
                  name="clientNameService"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Client Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="Enter client name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="accessTokenValidForNumberMinutes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Access Token Lifetime (minutes){" "}
                        <span className="text-xs font-normal text-muted-foreground">(5–120)</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="numeric"
                          autoComplete="off"
                          min={5}
                          max={120}
                          step={1}
                          placeholder="15"
                          aria-label="Access Token Lifetime in minutes"
                          value={
                            !Number.isFinite(field.value) || field.value === 0
                              ? ""
                              : String(field.value)
                          }
                          onChange={(e) => {
                            const raw = e.target.value.trim();
                            if (raw !== "" && !/^\d+$/.test(raw)) return;
                            const parsed = raw === "" ? 0 : Number(raw);
                            const clamped = parsed === 0 ? 0 : Math.min(120, Math.max(5, parsed));
                            field.onChange(clamped);
                            void form.trigger("accessTokenValidForNumberMinutes");
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between rounded-sm border p-3">
                        <div className="space-y-0.5">
                          <FormLabel className="text-sm">Status</FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Inactive credentials cannot be used to obtain new tokens.
                          </p>
                        </div>
                        <FormControl>
                          <Switch
                            size="md"
                            checked={Boolean(field.value)}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              </section>

              <FormField
                control={form.control}
                name="roles"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ClientCredentialRolesSection
                        selectedSlugs={field.value ?? []}
                        onChange={(slugs) => field.onChange(slugs)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="permissions"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ClientCredentialPermissionsSection
                        selectedResources={field.value ?? []}
                        onChange={(resources) => field.onChange(resources)}
                        maxPermissions={MAX_PERMISSIONS}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter className="shrink-0 px-6 py-4">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={isPending || !isDirty || !isValid} type="submit">
                {isPending
                  ? isEdit
                    ? "Updating..."
                    : "Saving..."
                  : isEdit
                    ? "Update Changes"
                    : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

import {
  Dialog,
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
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useFieldArray, useForm } from "react-hook-form";
import { Info, Plus, Pencil, X } from "lucide-react";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { ISaveOidcCredentialPayload } from "@blocks-idp/authentication/models/auth.oidc.model";
import {
  useGetAuthOidcCredential,
  useSaveAuthOidc,
} from "@blocks-idp/authentication/hooks/use-auth-oidc";
import {
  createOIDCFormDefaultValue,
  CreateOIDCFormValues,
  createOidcSchema,
  redirectUriSubmitSchema,
} from "./utils";
import { Input } from "@/components/ui-kits/input/input";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Button } from "@/components/ui-kits/button/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui-kits/tooltip/tooltip";
import { isErrorWithErrors } from "@/lib/error";

type CreateOIDCProps = {
  itemId?: string;
  triggerVariant?: "default" | "ghost" | "outline";
};

export const CreateOIDC = ({ itemId, triggerVariant = "default" }: CreateOIDCProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const [clientLogoUrl] = useState<string>("");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync, isPending } = useSaveAuthOidc();
  const { data: existingOidc, isLoading: _isLoadingOidc } = useGetAuthOidcCredential(
    { projectKey: tenantId, clientId: itemId! },
    open && !!itemId,
  );

  const form = useForm<CreateOIDCFormValues>({
    resolver: zodResolver(createOidcSchema),
    mode: "onChange",
    defaultValues: createOIDCFormDefaultValue,
  });

  const {
    formState: { isValid },
    control,
    register,
  } = form;

  const { fields, append, remove } = useFieldArray({
    control,
    name: "redirectUris",
  });

  const isEditMode = !!itemId;
  const dialogTitle = isEditMode ? "Edit OIDC Client" : "New OIDC Client";
  const dialogDescription = isEditMode
    ? "Update OIDC client details"
    : "Enter details to generate a new key";
  const isDeviceFlowClient = form.watch("isDeviceFlowClient");

  useEffect(() => {
    if (isEditMode && existingOidc?.oIDCClientCredential && open) {
      const credential = existingOidc.oIDCClientCredential;
      const uris =
        credential.redirectUris && credential.redirectUris.length
          ? credential.redirectUris
          : credential.redirectUri
            ? [credential.redirectUri]
            : [""];
      form.reset({
        redirectUris: uris.map((u) => ({ value: u })),
        scope: credential.scope || "openid",
        clientBrandColor: credential.clientBrandColor || "#124091",
        clientDisplayName: credential.clientDisplayName || "",
        isAutoRedirect: credential.isDeviceFlowClient ? false : (credential.isAutoRedirect ?? false),
        isActive: credential.isActive ?? true,
        requirePkce: credential.requirePkce ?? true,
        registerAsIdentityProvider: credential.registerAsIdentityProvider ?? false,
        isDeviceFlowClient: credential.isDeviceFlowClient ?? false,
        allowedResponseTypes: credential.isDeviceFlowClient
          ? []
          : credential.allowedResponseTypes && credential.allowedResponseTypes.length
            ? credential.allowedResponseTypes
            : ["code"],
      });
    } else if (!isEditMode && open) {
      form.reset({
        ...createOIDCFormDefaultValue,
        clientBrandColor: "#124091",
      });
    }
  }, [existingOidc, isEditMode, open, form]);

  const onSubmit = async (data: CreateOIDCFormValues) => {
    const isDeviceFlowClient = data.isDeviceFlowClient;
    const redirectResult = isDeviceFlowClient
      ? { success: true } as const
      : redirectUriSubmitSchema.safeParse(data.redirectUris);
    if (!redirectResult.success) {
      redirectResult.error.issues.forEach((issue) => {
        const path = issue.path as (string | number)[];
        form.setError(
          `redirectUris.${path[0]}.value` as keyof CreateOIDCFormValues,
          { type: "validate", message: issue.message },
          { shouldFocus: true },
        );
      });
      return;
    }
    try {
      const payload: ISaveOidcCredentialPayload = {
        redirectUris: isDeviceFlowClient
          ? []
          : data.redirectUris.map((entry) => entry.value.trim()).filter(Boolean),
        scope: data.scope,
        isAutoRedirect: isDeviceFlowClient ? false : data.isAutoRedirect,
        isActive: data.isActive,
        requirePkce: isDeviceFlowClient ? false : data.requirePkce,
        registerAsIdentityProvider: isDeviceFlowClient ? false : data.registerAsIdentityProvider,
        isDeviceFlowClient,
        allowedResponseTypes: isDeviceFlowClient ? [] : data.allowedResponseTypes,
        itemId: isEditMode ? itemId : "",
        clientLogoUrl: clientLogoUrl || undefined,
        clientBrandColor: data.clientBrandColor || undefined,
        clientDisplayName: data.clientDisplayName,
      };
      const res = await mutateAsync(payload);
      if (!res.isSuccess) {
        showErrorToast({ errors: res.error });
        return;
      }
      const message = isEditMode
        ? "OIDC Client updated successfully"
        : "OIDC Client created successfully";
      showSuccessToast({ description: message });
      form.reset();
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        showErrorToast({ errors: error.errors });
        return;
      }
      showErrorToast({ errors: "Something went wrong" });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {isEditMode ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                variant={triggerVariant}
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-high-emphasis"
                aria-label="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent>Edit</TooltipContent>
        </Tooltip>
      ) : (
        <DialogTrigger asChild>
          <Button>
            <Plus className="aspect-square w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">Create</span>
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="flex h-screen max-h-[95vh] w-screen flex-col rounded-none sm:h-auto sm:max-h-[95vh] sm:w-auto sm:rounded-lg md:h-auto md:w-[640px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form id="oidc-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 px-1">
              <FormField
                control={form.control}
                name="clientDisplayName"
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
                name="isDeviceFlowClient"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Device Flow</FormLabel>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="isDeviceFlowClient"
                        className="shrink-0"
                        checked={!!field.value}
                        onCheckedChange={(v) => {
                          field.onChange(!!v);
                          if (v) {
                            form.clearErrors("redirectUris");
                            // Auto redirect is meaningless without a browser
                            // redirect, so drop any value held before the toggle.
                            form.setValue("isAutoRedirect", false);
                          }
                        }}
                      />
                      <label
                        htmlFor="isDeviceFlowClient"
                        className="cursor-pointer text-sm text-high-emphasis"
                      >
                        Generate this OIDC client only for device flow
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Redirect URI(s) - multi entry like identity provider */}
              {!isDeviceFlowClient && (
                <div className="space-y-2">
                  <FormLabel>
                    Redirect URI(s) <span className="text-destructive">*</span>
                  </FormLabel>
                  {fields.map((fieldItem, idx) => (
                    <div key={fieldItem.id} className="flex items-start gap-2">
                      <div className="flex-1 space-y-1">
                        <Input
                          placeholder="https://example.com/oidc"
                          {...register(`redirectUris.${idx}.value` as const)}
                        />
                        <FormMessage>
                          {form.formState.errors.redirectUris?.[idx]?.value?.message as string}
                        </FormMessage>
                      </div>
                      {fields.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="mt-0 h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => remove(idx)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-1 h-7 gap-1 px-2 text-xs"
                    onClick={() => append({ value: "" })}
                  >
                    <Plus className="h-3 w-3" />
                    Add Redirect URI
                  </Button>
                  {form.formState.errors.redirectUris &&
                    !Array.isArray(form.formState.errors.redirectUris) && (
                      <p className="text-xs text-destructive">
                        {form.formState.errors.redirectUris.message as string}
                      </p>
                    )}
                </div>
              )}

              {/* Status | Scope(s) | PKCE — single borderless row */}
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="isActive"
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(!!v)}
                        />
                        <label
                          htmlFor="isActive"
                          className="cursor-pointer text-sm text-high-emphasis"
                        >
                          Active
                        </label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="scope"
                  render={() => (
                    <FormItem>
                      <FormLabel>Scope(s)</FormLabel>
                      <FormControl>
                        <div className="flex items-center gap-2">
                          <Checkbox id="scope-openid" checked disabled />
                          <label
                            htmlFor="scope-openid"
                            className="cursor-not-allowed text-sm text-muted-foreground"
                          >
                            openid
                          </label>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!isDeviceFlowClient && (
                  <FormField
                    control={form.control}
                    name="requirePkce"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>PKCE</FormLabel>
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="requirePkce"
                            checked={!!field.value}
                            onCheckedChange={(v) => field.onChange(!!v)}
                          />
                          <label
                            htmlFor="requirePkce"
                            className="cursor-pointer text-sm text-high-emphasis"
                          >
                            Enabled
                          </label>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Auto Redirect — single borderless row. Device-flow clients never
                  redirect a browser: the device polls /oidc/token while the user
                  approves elsewhere, so the option doesn't apply. */}
              {!isDeviceFlowClient && (
                <FormField
                  control={form.control}
                  name="isAutoRedirect"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Auto Redirect</FormLabel>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="isAutoRedirect"
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(!!v)}
                        />
                        <label
                          htmlFor="isAutoRedirect"
                          className="cursor-pointer text-sm text-high-emphasis"
                        >
                          Redirect automatically after authentication
                        </label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {/* Register as Identity Provider — on by default; the full
                  explanation lives in the tooltip to keep the row compact.
                  Not offered for device-flow clients: federation hardcodes the
                  authorization_code grant and reuses redirect URIs, which
                  device-flow clients don't have. */}
              {!isDeviceFlowClient && (
                <FormField
                  control={form.control}
                  name="registerAsIdentityProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Identity Provider</FormLabel>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="registerAsIdentityProvider"
                          className="shrink-0"
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(!!v)}
                        />
                        <label
                          htmlFor="registerAsIdentityProvider"
                          className="cursor-pointer text-sm text-high-emphasis"
                        >
                          Register as a Blocks OIDC identity provider
                        </label>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              aria-label="More about Blocks OIDC identity providers"
                              className="shrink-0 rounded-full text-muted-foreground transition-colors hover:text-high-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            >
                              <Info className="h-4 w-4" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="max-w-xs">
                            <p className="text-xs leading-relaxed">
                              Adds a matching <span className="font-medium">Blocks OIDC</span> entry
                              under Identity Provider, so other Blocks projects can offer this project
                              as a sign-in option and federate their users to it. Uncheck if this
                              client is only used by your own app to sign users in — you can always
                              add the provider later.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </form>
          </Form>
        </div>
        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            onClick={() => setOpen(false)}
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            form="oidc-form"
            type="submit"
            disabled={!isValid || isPending}
            className="w-full sm:w-auto"
          >
            {isEditMode ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

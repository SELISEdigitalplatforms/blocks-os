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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-kits/select/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Pencil, X } from "lucide-react";
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
} from "./utils";
import { Input } from "@/components/ui-kits/input/input";
import { Checkbox } from "@/components/ui-kits/checkbox/checkbox";
import { Button } from "@/components/ui-kits/button/button";
import { isErrorWithErrors } from "@/lib/error";
import { DUMMY_LOG_SERVICES } from "@blocks-lmt/constants/logs-dummy.constant";

type CreateOIDCProps = {
  itemId?: string;
  triggerVariant?: "default" | "ghost" | "outline";
};

export const CreateOIDC = ({ itemId, triggerVariant = "default" }: CreateOIDCProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const [clientLogoUrl] = useState<string>("");
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync, isPending } = useSaveAuthOidc();
  const { data: existingOidc, isLoading: isLoadingOidc } = useGetAuthOidcCredential(
    { projectKey: tenantId, clientId: itemId! },
    open && !!itemId,
  );

  const form = useForm<CreateOIDCFormValues>({
    resolver: zodResolver(createOidcSchema),
    mode: "all",
    defaultValues: createOIDCFormDefaultValue,
  });

  const {
    formState: { isDirty, isValid },
    control,
    watch,
    setValue,
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
    : "Enter details to create a new key";

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
        audienceUrlOidc: credential.audience,
        scope: credential.scope || "openid",
        clientBrandColor: credential.clientBrandColor || "#124091",
        clientDisplayName: credential.clientDisplayName || "",
        isAutoRedirect: credential.isAutoRedirect ?? false,
        isActive: credential.isActive ?? true,
        requirePkce: credential.requirePkce ?? true,
        allowedResponseTypes:
          credential.allowedResponseTypes && credential.allowedResponseTypes.length
            ? credential.allowedResponseTypes
            : ["code"],
        allowedServiceAccessResources: credential.allowedServiceAccessResources ?? [],
      });
    } else if (!isEditMode && open) {
      form.reset({
        ...createOIDCFormDefaultValue,
        clientBrandColor: "#124091",
      });
    }
  }, [existingOidc, isEditMode, open, form]);

  const onSubmit = async (data: CreateOIDCFormValues) => {
    try {
      const payload: ISaveOidcCredentialPayload = {
        audience: data.audienceUrlOidc,
        redirectUris: data.redirectUris
          .map((entry) => entry.value.trim())
          .filter(Boolean),
        scope: data.scope,
        isAutoRedirect: data.isAutoRedirect,
        isActive: data.isActive,
        requirePkce: data.requirePkce,
        allowedResponseTypes: data.allowedResponseTypes,
        allowedServiceAccessResources: data.allowedServiceAccessResources,
        itemId: isEditMode ? itemId : "",
        projectKey: tenantId,
        clientLogoUrl: clientLogoUrl || undefined,
        clientBrandColor: data.clientBrandColor || undefined,
        clientDisplayName: data.clientDisplayName,
      };
      const res = await mutateAsync(payload);
      if (!res.isSuccess) return showErrorToast({ errors: res.error });
      const message = isEditMode
        ? "OIDC Client updated successfully"
        : "OIDC Client created successfully";
      showSuccessToast({ description: message });
      setOpen(false);
    } catch (error) {
      if (isErrorWithErrors(error)) return showErrorToast({ errors: error.errors });
      return showErrorToast({ errors: "Something went wrong" });
    } finally {
      form.reset();
    }
  };

  const selectedServices = watch("allowedServiceAccessResources") ?? [];
  const allowedServicesValue = selectedServices[0] ?? "";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEditMode ? (
          <Button variant={triggerVariant} size="sm">
            <Pencil className="h-4 w-4" />
          </Button>
        ) : (
          <Button>
            <Plus className="aspect-square w-4" />
            <span className="sr-only sm:not-sr-only sm:ml-2">Create</span>
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex h-screen max-h-[95vh] w-screen flex-col rounded-none sm:h-auto sm:max-h-[95vh] sm:w-auto sm:rounded-lg md:h-auto md:w-[600px]">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>{dialogDescription}</DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto">
          <Form {...form}>
            <form id="oidc-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 px-4">
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

              {/* Redirect URI(s) - multi entry like identity provider */}
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
                        <label htmlFor="isActive" className="cursor-pointer text-sm text-high-emphasis">
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
                          <label htmlFor="scope-openid" className="cursor-not-allowed text-sm text-muted-foreground">
                            openid
                          </label>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requirePkce"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>PKCE</FormLabel>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="requirePkce"
                          checked={true}
                          disabled
                          onCheckedChange={() => field.onChange(true)}
                        />
                        <label
                          htmlFor="requirePkce"
                          className="cursor-not-allowed text-sm text-muted-foreground"
                        >
                          Enabled
                        </label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Allowed Services - dropdown bound to DUMMY_LOG_SERVICES id */}
              <FormField
                control={form.control}
                name="allowedServiceAccessResources"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Allowed Services</FormLabel>
                    <FormControl>
                      <Select
                        value={allowedServicesValue}
                        onValueChange={(v) => field.onChange(v ? [v] : [])}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select a service" />
                        </SelectTrigger>
                        <SelectContent>
                          {DUMMY_LOG_SERVICES.map((service) => (
                            <SelectItem key={service.id} value={service.id}>
                              {service.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Auto Redirect — single borderless row */}
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
                      <label htmlFor="isAutoRedirect" className="cursor-pointer text-sm text-high-emphasis">
                        Redirect automatically after authentication
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        </div>
        <DialogFooter>
          <Button onClick={() => setOpen(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            form="oidc-form"
            type="submit"
            disabled={!isValid || isPending || isLoadingOidc || !isDirty}
          >
            {isEditMode ? "Update" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

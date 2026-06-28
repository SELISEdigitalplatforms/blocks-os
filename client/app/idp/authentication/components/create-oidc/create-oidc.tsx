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
import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useFieldArray, useForm } from "react-hook-form";
import { Plus, Camera, Pencil, X } from "lucide-react";
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
import { useGetPreSignedUrlForUpload, useUploadFile } from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { ColorSwatch } from "@/components/color-swatch/color-swatch";
import { ModuleName } from "@/constants/modules.constants";
import { DUMMY_LOG_SERVICES } from "@blocks-lmt/constants/logs-dummy.constant";

type CreateOIDCProps = {
  itemId?: string;
  triggerVariant?: "default" | "ghost" | "outline";
};

const ALLOWED_RESPONSE_TYPES = [
  { value: "code", label: "code" },
  { value: "token", label: "token" },
  { value: "id_token", label: "id_token" },
];

export const CreateOIDC = ({ itemId, triggerVariant = "default" }: CreateOIDCProps) => {
  const [open, setOpen] = useState<boolean>(false);
  const [clientLogoUrl, setClientLogoUrl] = useState<string>("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const MAX_LOGO_FILE_SIZE = 5 * 1024 * 1024;
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { mutateAsync, isPending } = useSaveAuthOidc();
  const { data: existingOidc, isLoading: isLoadingOidc } = useGetAuthOidcCredential(
    { projectKey: tenantId, clientId: itemId! },
    open && !!itemId,
  );
  const { mutateAsync: getPreSign } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFile } = useUploadFile();

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
      setClientLogoUrl(credential.clientLogoUrl || "");
    } else if (!isEditMode && open) {
      form.reset({
        ...createOIDCFormDefaultValue,
        clientBrandColor: "#124091",
      });
      setClientLogoUrl("");
    }
  }, [existingOidc, isEditMode, open, form]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedImageTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "image/svg+xml",
    ];
    const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const fileName = file.name.toLowerCase();
    if (
      !allowedImageTypes.includes(file.type) &&
      !allowedExtensions.some((ext) => fileName.endsWith(ext))
    ) {
      showErrorToast({
        errors: "Invalid file type. Only JPG, JPEG, PNG, GIF, and WEBP files are allowed.",
      });
      e.target.value = "";
      return;
    }
    if (file.size > MAX_LOGO_FILE_SIZE) {
      showErrorToast({ errors: "Image size must be under 5 MB." });
      e.target.value = "";
      return;
    }
    try {
      setIsUploadingImage(true);
      const preSign = await getPreSign({
        accessModifier: "Public",
        configurationName: "Default",
        name: file.name,
        projectKey: tenantId ?? "",
        tags: "",
        metaData: "",
        parentDirectoryId: "",
        moduleName: ModuleName.IAMCloud,
      });
      if (!preSign.isSuccess) throw new Error("Failed to get upload URL");
      await uploadFile({ url: preSign.uploadUrl, file });
      const fileInfo = await storageService.file.getFileByFileId({
        itemId: preSign.fileId,
        projectKey: tenantId ?? "",
      });
      setClientLogoUrl(fileInfo.url);
      showSuccessToast({ description: "Logo uploaded successfully" });
    } catch (err: unknown) {
      if (isErrorWithErrors(err)) return showErrorToast({ errors: err.errors });
      showErrorToast({ errors: "Something went wrong uploading logo" });
    } finally {
      setIsUploadingImage(false);
      e.target.value = "";
    }
  };

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
      setClientLogoUrl("");
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
              <div className="flex flex-col items-center gap-4">
                <div className="relative h-32 w-32 overflow-hidden rounded-lg border border-dashed border-border bg-muted">
                  {clientLogoUrl ? (
                    <img src={clientLogoUrl} alt="OIDC Logo" className="object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                  {isUploadingImage && <div className="absolute inset-0 bg-muted/50" />}
                </div>
              </div>

              <FormField
                control={form.control}
                name="clientDisplayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Client Name</FormLabel>
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
                  className="mt-1 gap-1.5"
                  onClick={() => append({ value: "" })}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Redirect URI
                </Button>
                {form.formState.errors.redirectUris &&
                  !Array.isArray(form.formState.errors.redirectUris) && (
                    <p className="text-xs text-destructive">
                      {form.formState.errors.redirectUris.message as string}
                    </p>
                  )}
              </div>

              <FormField
                control={form.control}
                name="audienceUrlOidc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Audience</FormLabel>
                    <FormControl>
                      <Input placeholder="https://example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scope(s) - checkbox style like add identity provider */}
              <FormField
                control={form.control}
                name="scope"
                render={() => (
                  <FormItem>
                    <FormLabel>Scope(s)</FormLabel>
                    <FormControl>
                      <div className="flex items-center gap-2 rounded border p-4">
                        <Checkbox id="scope-openid" checked disabled />
                        <label htmlFor="scope-openid" className="cursor-pointer text-sm">
                          openid
                        </label>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* PKCE - locked true */}
              <FormField
                control={form.control}
                name="requirePkce"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2 rounded border p-4">
                      <Checkbox
                        id="requirePkce"
                        checked={true}
                        disabled
                        onCheckedChange={() => field.onChange(true)}
                      />
                      <label htmlFor="requirePkce" className="cursor-pointer text-sm">
                        PKCE
                      </label>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* AllowedResponseTypes - checkbox list, "code" selected */}
              <FormField
                control={form.control}
                name="allowedResponseTypes"
                render={({ field }) => {
                  const value = (field.value ?? []) as string[];
                  const toggle = (v: string) => {
                    const next = value.includes(v)
                      ? value.filter((x) => x !== v)
                      : [...value, v];
                    field.onChange(next);
                  };
                  return (
                    <FormItem>
                      <FormLabel>Allowed Response Types</FormLabel>
                      <div className="flex flex-col gap-2 rounded border p-4">
                        {ALLOWED_RESPONSE_TYPES.map((opt) => (
                          <div key={opt.value} className="flex items-center gap-2">
                            <Checkbox
                              id={`response-type-${opt.value}`}
                              checked={value.includes(opt.value)}
                              onCheckedChange={() => toggle(opt.value)}
                            />
                            <label
                              htmlFor={`response-type-${opt.value}`}
                              className="cursor-pointer text-sm"
                            >
                              {opt.label}
                            </label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  );
                }}
              />

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

              {/* IsAutoRedirect + IsActive checkboxes */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="isAutoRedirect"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded border p-4">
                        <Checkbox
                          id="isAutoRedirect"
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(!!v)}
                        />
                        <label htmlFor="isAutoRedirect" className="cursor-pointer text-sm">
                          IsAutoRedirect
                        </label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center gap-2 rounded border p-4">
                        <Checkbox
                          id="isActive"
                          checked={!!field.value}
                          onCheckedChange={(v) => field.onChange(!!v)}
                        />
                        <label htmlFor="isActive" className="cursor-pointer text-sm">
                          IsActive
                        </label>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { ModuleName } from "@/constants/modules.constants";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import {
  useGetOidcTemplate,
  useSaveOidcTemplate,
} from "@blocks-idp/authentication/hooks/use-oidc-template";
import { IOidcUiTemplate } from "@blocks-idp/authentication/models/auth.oidc.model";
import { useGetPreSignedUrlForUpload, useUploadFile } from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { useOidcBrandingHeader } from "@blocks-idp/authentication/contexts/oidc-branding-header-context";
import { OidcLoginPreview } from "./oidc-login-preview";

const DEFAULT_BRAND_COLOR = "#0066b2";
const MAX_LOGO_SIZE_MB = 2;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];
const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const validateBrandName = (value: string) => {
  if (!value.trim()) return "Brand name is required.";
  if (value.length > 80) return "Brand name must be 80 characters or fewer.";
  return null;
};

const validateBrandColor = (value: string) =>
  HEX_COLOR_PATTERN.test(value) ? null : "Brand color must be a valid hex value (#RGB or #RRGGBB).";

const validateLogoUrl = (value: string | null) => {
  if (value === null) return null;

  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && !!url.hostname
      ? null
      : "Logo URL must be an absolute http or https URL.";
  } catch {
    return "Logo URL must be an absolute http or https URL.";
  }
};

const getServerFieldError = (errors: Record<string, string>, field: string) => {
  const normalizedField = field.toLowerCase().replace(/[^a-z]/g, "");
  const entry = Object.entries(errors).find(
    ([key]) => key.toLowerCase().replace(/[^a-z]/g, "") === normalizedField,
  );
  return entry?.[1] ?? null;
};

const colorPickerValue = (value: string) => {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [r, g, b] = value.slice(1);
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return DEFAULT_BRAND_COLOR;
};

export const OidcBrandingForm = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setActions } = useOidcBrandingHeader();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  const { data: template, isLoading, isError } = useGetOidcTemplate();
  const { mutateAsync: saveTemplate, isPending: isSaving } = useSaveOidcTemplate();
  const { mutateAsync: getPresignedUrl } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFile } = useUploadFile();

  const [savedTemplate, setSavedTemplate] = useState<IOidcUiTemplate | null>(template ?? null);
  const [brandName, setBrandName] = useState(template?.branding.brandName ?? "");
  const [brandColor, setBrandColor] = useState(
    template?.theme.light.primary || DEFAULT_BRAND_COLOR,
  );
  const [logoUrl, setLogoUrl] = useState<string | null>(template?.branding.logoUrl ?? null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(
    template?.branding.logoUrl ?? null,
  );
  const [logoValidationMessage, setLogoValidationMessage] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [previousTemplate, setPreviousTemplate] = useState(template);
  if (template !== previousTemplate) {
    setPreviousTemplate(template);
    setSavedTemplate(template ?? null);
    if (template) {
      setBrandName(template.branding.brandName);
      setBrandColor(template.theme.light.primary || DEFAULT_BRAND_COLOR);
      setLogoUrl(template.branding.logoUrl);
      setPreviewLogoUrl(template.branding.logoUrl);
      setPendingLogoFile(null);
      setLogoValidationMessage(null);
      setServerErrors({});
    }
  }

  useEffect(() => {
    return () => {
      if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);
    };
  }, [previewLogoUrl]);

  const clearServerFieldError = (field: string) => {
    const normalizedField = field.toLowerCase().replace(/[^a-z]/g, "");
    setServerErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([key]) => key.toLowerCase().replace(/[^a-z]/g, "") !== normalizedField,
        ),
      ),
    );
  };

  const applyLogoFile = (file: File) => {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      return showErrorToast({ errors: "Only PNG, JPG, SVG, and WebP images are allowed" });
    }
    if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
      return showErrorToast({ errors: `Logo must be smaller than ${MAX_LOGO_SIZE_MB}MB` });
    }

    if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);
    setPendingLogoFile(file);
    setPreviewLogoUrl(URL.createObjectURL(file));
    setLogoValidationMessage(null);
    clearServerFieldError("branding.logoUrl");
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) applyLogoFile(file);
  };

  const removeLogo = () => {
    if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);
    setLogoUrl(null);
    setPreviewLogoUrl(null);
    setPendingLogoFile(null);
    setLogoValidationMessage(null);
    clearServerFieldError("branding.logoUrl");
  };

  const uploadLogoToStorage = useCallback(
    async (file: File): Promise<string> => {
      const res = await getPresignedUrl({
        itemId: "",
        accessModifier: "Public",
        configurationName: "Default",
        name: file.name,
        projectKey: tenantId,
        tags: "",
        metaData: "",
        parentDirectoryId: "",
        moduleName: ModuleName.IAMCloud,
      });

      if (!res.isSuccess) throw new Error("Failed to get upload URL");

      await uploadFile({ url: res.uploadUrl, file });
      const fileRecord = await storageService.file.getFileByFileId({
        itemId: res.fileId,
        projectKey: tenantId,
      });

      return fileRecord.url;
    },
    [getPresignedUrl, uploadFile, tenantId],
  );

  const resetToSavedBranding = useCallback(() => {
    if (!savedTemplate) return;
    if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);

    setBrandName(savedTemplate.branding.brandName);
    setBrandColor(savedTemplate.theme.light.primary || DEFAULT_BRAND_COLOR);
    setLogoUrl(savedTemplate.branding.logoUrl);
    setPreviewLogoUrl(savedTemplate.branding.logoUrl);
    setPendingLogoFile(null);
    setLogoValidationMessage(null);
    setServerErrors({});
  }, [savedTemplate, previewLogoUrl]);

  const brandNameError =
    validateBrandName(brandName) || getServerFieldError(serverErrors, "branding.brandName");
  const brandColorError =
    validateBrandColor(brandColor) ||
    getServerFieldError(serverErrors, "theme.light.primary") ||
    getServerFieldError(serverErrors, "theme.dark.primary");
  const logoUrlError =
    logoValidationMessage ||
    validateLogoUrl(logoUrl) ||
    getServerFieldError(serverErrors, "branding.logoUrl");
  const isValid =
    !validateBrandName(brandName) &&
    !validateBrandColor(brandColor) &&
    !validateLogoUrl(logoUrl) &&
    !logoValidationMessage;

  const handleSave = useCallback(async () => {
    if (!savedTemplate || !isValid) return;

    try {
      setIsUploading(true);
      setServerErrors({});
      let resolvedLogoUrl = logoUrl;

      if (pendingLogoFile) resolvedLogoUrl = await uploadLogoToStorage(pendingLogoFile);

      const uploadedLogoError = validateLogoUrl(resolvedLogoUrl);
      if (uploadedLogoError) {
        setLogoValidationMessage(uploadedLogoError);
        return;
      }

      const payload: IOidcUiTemplate = {
        ...savedTemplate,
        branding: { ...savedTemplate.branding, brandName, logoUrl: resolvedLogoUrl },
        theme: {
          ...savedTemplate.theme,
          light: { ...savedTemplate.theme.light, primary: brandColor },
          dark: { ...savedTemplate.theme.dark, primary: brandColor },
        },
      };

      const res = await saveTemplate(payload);
      if (!res.isSuccess) {
        const errors = res.errors ?? { Template: "Failed to save template" };
        setServerErrors(errors);
        showErrorToast({ errors });
        return;
      }

      showSuccessToast({ description: "Template saved successfully" });
      setSavedTemplate(payload);
      setLogoUrl(resolvedLogoUrl);
      setPendingLogoFile(null);
      if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);
      setPreviewLogoUrl(resolvedLogoUrl);
      setLogoValidationMessage(null);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        setServerErrors(
          Object.fromEntries(
            Object.entries(error.errors).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(", ") : value,
            ]),
          ),
        );
        showErrorToast({ errors: error.errors });
        return;
      }
      showErrorToast({ errors: "Failed to save template" });
    } finally {
      setIsUploading(false);
    }
  }, [
    brandColor,
    brandName,
    isValid,
    logoUrl,
    pendingLogoFile,
    previewLogoUrl,
    saveTemplate,
    savedTemplate,
    uploadLogoToStorage,
  ]);

  const isBusy = isSaving || isUploading;
  const isDirty = useMemo(
    () =>
      !!savedTemplate &&
      (brandName !== savedTemplate.branding.brandName ||
        brandColor !== savedTemplate.theme.light.primary ||
        (previewLogoUrl ?? null) !== savedTemplate.branding.logoUrl),
    [brandColor, brandName, previewLogoUrl, savedTemplate],
  );

  useEffect(() => {
    if (!savedTemplate) {
      setActions(null);
      return;
    }

    setActions({
      onSave: handleSave,
      onUndo: resetToSavedBranding,
      isBusy,
      isDirty,
      isValid,
    });

    return () => setActions(null);
  }, [handleSave, isBusy, isDirty, isValid, resetToSavedBranding, savedTemplate, setActions]);

  if (isLoading) {
    return (
      <Card className="bg-background">
        <CardContent className="p-3 sm:p-5 lg:p-6">
          <div className="grid min-w-0 grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2 xl:gap-6">
            <section className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="border-b border-border pb-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-4 w-56" />
              </div>
              <div className="space-y-5">
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-10 w-full rounded" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-32 w-full rounded-lg" />
                </div>
                <div className="space-y-3">
                  <Skeleton className="h-4 w-24" />
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-14 rounded" />
                    <Skeleton className="h-10 w-[140px] rounded" />
                  </div>
                </div>
              </div>
            </section>
            <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
              <div className="border-b border-border pb-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="mt-2 h-4 w-56" />
              </div>
              <Skeleton className="h-[380px] w-full rounded-lg sm:h-[460px] lg:h-[520px]" />
            </section>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (isError || !savedTemplate) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive" role="alert">
          Unable to load the OIDC template. Check that the IAM API is available and try again.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background">
      <CardContent className="p-3 sm:p-5 lg:p-6">
        <div className="grid min-w-0 grid-cols-1 gap-4 md:gap-5 xl:grid-cols-2 xl:gap-6">
          <section className="flex min-w-0 flex-col gap-5 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-semibold text-high-emphasis">Configuration</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Set a brand name, upload a logo, and choose a primary color.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="brand-name">
                  Brand name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="brand-name"
                  value={brandName}
                  maxLength={81}
                  aria-invalid={!!brandNameError}
                  aria-describedby={brandNameError ? "brand-name-error" : undefined}
                  onChange={(event) => {
                    setBrandName(event.target.value);
                    clearServerFieldError("branding.brandName");
                  }}
                />
                {brandNameError && (
                  <p id="brand-name-error" className="text-sm text-destructive" role="alert">
                    {brandNameError}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="client-logo-upload">Client logo</Label>
                <div
                  className={cn(
                    "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-4 sm:p-6 transition-colors",
                    isDragOver
                      ? "border-primary bg-primary/5"
                      : "border-border bg-muted/20 hover:bg-muted/30",
                  )}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragOver(false);
                    const file = event.dataTransfer.files?.[0];
                    if (file) applyLogoFile(file);
                  }}
                >
                  <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                    {previewLogoUrl ? (
                      <img
                        src={previewLogoUrl}
                        alt="Logo preview"
                        className="max-h-full max-w-full object-contain p-1"
                      />
                    ) : (
                      <ImagePlus className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <input
                    id="client-logo-upload"
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
                    className="sr-only"
                    onChange={handleLogoFileChange}
                  />
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isBusy}
                      className="gap-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Upload logo
                    </Button>
                    {previewLogoUrl && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isBusy}
                        className="gap-2 text-destructive"
                        onClick={removeLogo}
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove logo
                      </Button>
                    )}
                  </div>
                  <p className="text-center text-xs text-muted-foreground">
                    Drag and drop or browse. PNG, JPG, SVG, or WebP up to {MAX_LOGO_SIZE_MB}MB.
                  </p>
                </div>
                {logoUrlError && (
                  <p className="text-sm text-destructive" role="alert">
                    {logoUrlError}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="brand-color">Brand color</Label>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="brand-color"
                    type="color"
                    value={colorPickerValue(brandColor)}
                    onChange={(event) => {
                      setBrandColor(event.target.value);
                      clearServerFieldError("theme.light.primary");
                      clearServerFieldError("theme.dark.primary");
                    }}
                    className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-1"
                    aria-label="Pick brand color"
                  />
                  <Input
                    aria-label="Brand color hex value"
                    value={brandColor}
                    onChange={(event) => {
                      setBrandColor(event.target.value);
                      clearServerFieldError("theme.light.primary");
                      clearServerFieldError("theme.dark.primary");
                    }}
                    className="w-[140px] min-w-[120px] font-mono text-sm uppercase"
                    maxLength={7}
                    aria-invalid={!!brandColorError}
                    aria-describedby={brandColorError ? "brand-color-error" : undefined}
                  />
                </div>
                {brandColorError && (
                  <p id="brand-color-error" className="text-sm text-destructive" role="alert">
                    {brandColorError}
                  </p>
                )}
              </div>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="border-b border-border pb-3">
              <h2 className="text-base font-semibold text-high-emphasis">Live Preview</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Changes appear here in real time.
              </p>
            </div>
            <div className="min-w-0 overflow-hidden rounded-lg border border-border/70 bg-muted/20 p-0 sm:p-3">
              <OidcLoginPreview clientLogoUrl={previewLogoUrl} clientBrandColor={brandColor} />
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
};

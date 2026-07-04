import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { ModuleName } from "@/constants/modules.constants";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import {
  useGetAuthOidcCredential,
  useSaveAuthOidc,
} from "@blocks-idp/authentication/hooks/use-auth-oidc";
import {
  useGetPreSignedUrlForUpload,
  useUploadFile,
} from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { useProjectStore } from "@seliseblocks/blocks-kit";
import { useOidcBrandingHeader } from "@blocks-idp/authentication/contexts/oidc-branding-header-context";
import { OidcLoginPreview } from "./oidc-login-preview";
import { buildOidcSavePayload } from "./build-oidc-save-payload";

const DEFAULT_BRAND_COLOR = "#124091";
const MAX_LOGO_SIZE_MB = 2;
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
];

type OidcBrandingFormProps = {
  clientId: string;
};

export const OidcBrandingForm = ({ clientId }: OidcBrandingFormProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setActions } = useOidcBrandingHeader();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";

  const { data, isLoading } = useGetAuthOidcCredential(
    { projectKey: tenantId, clientId },
    !!tenantId && !!clientId,
  );

  const { mutateAsync: saveOidc, isPending: isSaving } = useSaveAuthOidc();
  const { mutateAsync: getPresignedUrl } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFile } = useUploadFile();

  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const credential = data?.oIDCClientCredential;

  useEffect(() => {
    if (!credential) return;
    setBrandColor(credential.clientBrandColor || DEFAULT_BRAND_COLOR);
    setLogoUrl(credential.clientLogoUrl ?? null);
    setPreviewLogoUrl(credential.clientLogoUrl ?? null);
    setPendingLogoFile(null);
  }, [credential]);

  useEffect(() => {
    return () => {
      if (previewLogoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewLogoUrl);
      }
    };
  }, [previewLogoUrl]);

  const applyLogoFile = (file: File) => {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      return showErrorToast({
        errors: "Only PNG, JPG, SVG, and WebP images are allowed",
      });
    }
    if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
      return showErrorToast({
        errors: `Logo must be smaller than ${MAX_LOGO_SIZE_MB}MB`,
      });
    }

    if (previewLogoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewLogoUrl);
    }

    setPendingLogoFile(file);
    setPreviewLogoUrl(URL.createObjectURL(file));
  };

  const handleLogoFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    applyLogoFile(file);
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

      if (!res.isSuccess) {
        throw new Error("Failed to get upload URL");
      }

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
    if (!credential) return;

    if (previewLogoUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewLogoUrl);
    }

    setBrandColor(credential.clientBrandColor || DEFAULT_BRAND_COLOR);
    setLogoUrl(credential.clientLogoUrl ?? null);
    setPreviewLogoUrl(credential.clientLogoUrl ?? null);
    setPendingLogoFile(null);
  }, [credential, previewLogoUrl]);

  const handleSave = useCallback(async () => {
    if (!credential) return;

    try {
      setIsUploading(true);
      let resolvedLogoUrl = logoUrl ?? undefined;

      if (pendingLogoFile) {
        resolvedLogoUrl = await uploadLogoToStorage(pendingLogoFile);
      }

      const payload = buildOidcSavePayload(credential, tenantId, {
        clientLogoUrl: resolvedLogoUrl,
        clientBrandColor: brandColor,
      });

      const res = await saveOidc(payload);
      if (!res.isSuccess) {
        return showErrorToast({ errors: res.error });
      }

      showSuccessToast({ description: "Template saved successfully" });
      setLogoUrl(resolvedLogoUrl ?? null);
      setPendingLogoFile(null);
      if (previewLogoUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(previewLogoUrl);
      }
      setPreviewLogoUrl(resolvedLogoUrl ?? null);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        return showErrorToast({ errors: error.errors });
      }
      return showErrorToast({ errors: "Failed to save template" });
    } finally {
      setIsUploading(false);
    }
  }, [
    brandColor,
    credential,
    logoUrl,
    pendingLogoFile,
    previewLogoUrl,
    saveOidc,
    tenantId,
    uploadLogoToStorage,
  ]);

  const handleUndo = useCallback(() => {
    resetToSavedBranding();
  }, [resetToSavedBranding]);

  const isBusy = isSaving || isUploading;

  useEffect(() => {
    if (!credential) {
      setActions(null);
      return;
    }

    setActions({
      onSave: handleSave,
      onUndo: handleUndo,
      isBusy,
    });

    return () => setActions(null);
  }, [credential, handleSave, handleUndo, isBusy, setActions]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Loading client…
      </div>
    );
  }

  if (!credential) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          OIDC client not found.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-background">
      <CardContent className="p-6">
        <div className="grid min-w-0 gap-8 lg:grid-cols-2 lg:gap-6">
          <section className="flex min-w-0 flex-col gap-6">
            <h2 className="text-base font-semibold text-high-emphasis">
              Configuration
            </h2>

            <div className="space-y-3">
              <Label htmlFor="client-logo-upload">Client logo</Label>
              <div
                className={cn(
                  "flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed p-6 transition-colors",
                  isDragOver
                    ? "border-primary bg-primary/5"
                    : "border-border bg-muted/20 hover:bg-muted/30",
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragOver(true);
                }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) applyLogoFile(file);
                }}>
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
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isBusy}
                  className="gap-2"
                  onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Upload logo
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  Drag and drop or browse. PNG, JPG, SVG, or WebP up to{" "}
                  {MAX_LOGO_SIZE_MB}MB.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="brand-color">Brand color</Label>
              <div className="flex items-center gap-3">
                <input
                  id="brand-color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="h-10 w-14 cursor-pointer rounded border border-border bg-transparent p-1"
                  aria-label="Pick brand color"
                />
                <Input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  className="max-w-[140px] font-mono text-sm uppercase"
                  maxLength={7}
                />
              </div>
            </div>
          </section>

          <section className="flex min-w-0 flex-col gap-3 lg:border-l lg:border-border lg:pl-6">
            <h2 className="text-base font-semibold text-high-emphasis">
              Live preview
            </h2>
            <div className="min-w-0 overflow-hidden rounded-lg">
              <OidcLoginPreview
                clientLogoUrl={previewLogoUrl}
                clientBrandColor={brandColor}
              />
            </div>
          </section>
        </div>
      </CardContent>
    </Card>
  );
};

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { ModuleName } from "@/constants/modules.constants";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import { useOidcBrandingHeader } from "@blocks-idp/authentication/contexts/oidc-branding-header-context";
import {
  useGetOidcTemplate,
  useSaveOidcTemplate,
} from "@blocks-idp/authentication/hooks/use-oidc-template";
import type {
  IOidcUiTemplate,
  IOidcUiThemePalette,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import { useGetPreSignedUrlForUpload, useUploadFile } from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { useProjectStore } from "@seliseblocks/genesis-os";
import { OidcTemplatePreview } from "./oidc-template-preview";
import { DEFAULT_OIDC_UI_TEMPLATE, normalizeOidcUiTemplate } from "./oidc-template-defaults";
import {
  PAGE_FIELDS,
  PAGE_OPTIONS,
  THEME_FIELDS,
  type OidcPageKey,
  validateOidcUiTemplate,
} from "./oidc-template-validation";
import type { OidcPreviewTheme, OidcPreviewThemeMode } from "./oidc-preview-shared";

const DEFAULT_COLOR = "#0066b2";
const MAX_LOGO_SIZE_MB = 2;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];

type EditorTab = "branding" | "theme" | "pages";

const normalizeField = (value: string) => value.toLowerCase().replace(/[^a-z]/g, "");

const getServerFieldError = (errors: Record<string, string>, field: string) => {
  const entry = Object.entries(errors).find(
    ([key]) => normalizeField(key) === normalizeField(field),
  );
  return entry?.[1] ?? null;
};

const colorPickerValue = (value: string) => {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    const [red, green, blue] = value.slice(1);
    return `#${red}${red}${green}${green}${blue}${blue}`;
  }
  return DEFAULT_COLOR;
};

const TemplateSkeleton = () => (
  <Card className="bg-background">
    <CardContent className="p-3 sm:p-5 lg:p-6">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        {[0, 1].map((column) => (
          <section key={column} className="space-y-5 rounded-xl border border-border bg-card p-5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-56" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-10 w-2/3" />
          </section>
        ))}
      </div>
    </CardContent>
  </Card>
);

const ColorInput = ({
  palette,
  field,
  label,
  value,
  error,
  onChange,
}: {
  palette: OidcPreviewTheme;
  field: keyof IOidcUiThemePalette;
  label: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) => {
  const id = `theme-${palette}-${field}`;
  const paletteLabel = palette === "light" ? "Light" : "Dark";
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="capitalize">
        {label} <span className="text-destructive">*</span>
      </Label>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-picker`}
          type="color"
          aria-label={`${paletteLabel} ${label} color picker`}
          value={colorPickerValue(value)}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-12 cursor-pointer rounded border border-border bg-transparent p-1"
        />
        <Input
          id={id}
          aria-label={`${paletteLabel} ${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={48}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="min-w-0 font-mono text-sm"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {paletteLabel} {label} {error}
        </p>
      )}
    </div>
  );
};

export const OidcBrandingForm = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { setActions } = useOidcBrandingHeader();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: template, isLoading, isError } = useGetOidcTemplate();
  const { mutateAsync: saveTemplate, isPending: isSaving } = useSaveOidcTemplate();
  const { mutateAsync: getPresignedUrl } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFile } = useUploadFile();

  const sourceTemplate = !isLoading && !isError ? (template ?? DEFAULT_OIDC_UI_TEMPLATE) : null;
  const normalizedTemplate = sourceTemplate ? normalizeOidcUiTemplate(sourceTemplate) : null;
  const [savedTemplate, setSavedTemplate] = useState<IOidcUiTemplate | null>(normalizedTemplate);
  const [draft, setDraft] = useState<IOidcUiTemplate | null>(normalizedTemplate);
  const [editorTab, setEditorTab] = useState<EditorTab>("branding");
  const [selectedPage, setSelectedPage] = useState<OidcPageKey>("login");
  const [paletteMode, setPaletteMode] = useState<OidcPreviewTheme>("light");
  const [previewMode, setPreviewMode] = useState<OidcPreviewThemeMode>("system");
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(
    normalizedTemplate?.branding.logoUrl ?? null,
  );
  const [logoValidationMessage, setLogoValidationMessage] = useState<string | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const [previousTemplate, setPreviousTemplate] = useState(sourceTemplate);
  if (sourceTemplate !== previousTemplate) {
    setPreviousTemplate(sourceTemplate);
    const next = sourceTemplate ? normalizeOidcUiTemplate(sourceTemplate) : null;
    setSavedTemplate(next);
    setDraft(next);
    setPreviewLogoUrl(next?.branding.logoUrl ?? null);
    setPendingLogoFile(null);
    setLogoValidationMessage(null);
    setServerErrors({});
  }

  useEffect(
    () => () => {
      if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);
    },
    [previewLogoUrl],
  );

  const clearServerFieldError = useCallback((field: string) => {
    setServerErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => normalizeField(key) !== normalizeField(field)),
      ),
    );
  }, []);

  const updateBranding = (field: "brandName" | "logoUrl", value: string | null) => {
    setDraft((current) =>
      current ? { ...current, branding: { ...current.branding, [field]: value } } : current,
    );
    clearServerFieldError(`branding.${field}`);
  };

  const updatePalette = (
    mode: OidcPreviewTheme,
    field: keyof IOidcUiThemePalette,
    value: string,
  ) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            theme: {
              ...current.theme,
              [mode]: { ...current.theme[mode], [field]: value },
            },
          }
        : current,
    );
    clearServerFieldError(`theme.${mode}.${field}`);
  };

  const updatePage = (field: string, value: string | null) => {
    setDraft((current) => {
      if (!current) return current;
      const page = current.pages[selectedPage] as unknown as Record<string, string | null>;
      return {
        ...current,
        pages: {
          ...current.pages,
          [selectedPage]: { ...page, [field]: value },
        },
      } as IOidcUiTemplate;
    });
    clearServerFieldError(`pages.${selectedPage}.${field}`);
  };

  const applyLogoFile = (file: File) => {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      showErrorToast({ errors: "Only PNG, JPG, SVG, and WebP images are allowed" });
      return;
    }
    if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
      showErrorToast({ errors: `Logo must be smaller than ${MAX_LOGO_SIZE_MB}MB` });
      return;
    }
    if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);
    setPendingLogoFile(file);
    setPreviewLogoUrl(URL.createObjectURL(file));
    setLogoValidationMessage(null);
    clearServerFieldError("branding.logoUrl");
  };

  const removeLogo = () => {
    if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);
    setPendingLogoFile(null);
    setPreviewLogoUrl(null);
    setLogoValidationMessage(null);
    updateBranding("logoUrl", null);
  };

  const uploadLogoToStorage = useCallback(
    async (file: File) => {
      const response = await getPresignedUrl({
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
      if (!response.isSuccess) throw new Error("Failed to get upload URL");
      await uploadFile({ url: response.uploadUrl, file });
      const fileRecord = await storageService.file.getFileByFileId({
        itemId: response.fileId,
        projectKey: tenantId,
      });
      return fileRecord.url;
    },
    [getPresignedUrl, tenantId, uploadFile],
  );

  const validationErrors = useMemo(() => (draft ? validateOidcUiTemplate(draft) : {}), [draft]);
  const fieldError = (field: string) =>
    validationErrors[field] ?? getServerFieldError(serverErrors, field);
  const isValid = Object.keys(validationErrors).length === 0 && !logoValidationMessage;
  const isDirty = useMemo(
    () =>
      !!draft &&
      !!savedTemplate &&
      (JSON.stringify(draft) !== JSON.stringify(savedTemplate) || !!pendingLogoFile),
    [draft, pendingLogoFile, savedTemplate],
  );
  const isBusy = isSaving || isUploading;

  const resetToSavedTemplate = useCallback(() => {
    if (!savedTemplate) return;
    if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);
    const restored = structuredClone(savedTemplate);
    setDraft(restored);
    setPreviewLogoUrl(restored.branding.logoUrl);
    setPendingLogoFile(null);
    setLogoValidationMessage(null);
    setServerErrors({});
  }, [previewLogoUrl, savedTemplate]);

  const handleSave = useCallback(async () => {
    if (!draft || !isValid) return;
    try {
      setIsUploading(true);
      setServerErrors({});
      const payload = structuredClone(draft);
      if (pendingLogoFile) payload.branding.logoUrl = await uploadLogoToStorage(pendingLogoFile);

      const uploadedErrors = validateOidcUiTemplate(payload);
      if (uploadedErrors["branding.logoUrl"]) {
        setLogoValidationMessage(uploadedErrors["branding.logoUrl"]);
        return;
      }

      const response = await saveTemplate(payload);
      if (!response.isSuccess) {
        const errors = response.errors ?? { Template: "Failed to save template" };
        setServerErrors(errors);
        showErrorToast({ errors });
        return;
      }

      showSuccessToast({ description: "Template saved successfully" });
      setSavedTemplate(payload);
      setDraft(payload);
      setPendingLogoFile(null);
      if (previewLogoUrl?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrl);
      setPreviewLogoUrl(payload.branding.logoUrl);
      setLogoValidationMessage(null);
    } catch (error) {
      if (isErrorWithErrors(error)) {
        const errors = Object.fromEntries(
          Object.entries(error.errors).map(([key, value]) => [
            key,
            Array.isArray(value) ? value.join(", ") : value,
          ]),
        );
        setServerErrors(errors);
        showErrorToast({ errors: error.errors });
      } else {
        showErrorToast({ errors: "Failed to save template" });
      }
    } finally {
      setIsUploading(false);
    }
  }, [draft, isValid, pendingLogoFile, previewLogoUrl, saveTemplate, uploadLogoToStorage]);

  useEffect(() => {
    if (!savedTemplate) {
      setActions(null);
      return;
    }
    setActions({
      onSave: handleSave,
      onUndo: resetToSavedTemplate,
      isBusy,
      isDirty,
      isValid,
    });
    return () => setActions(null);
  }, [handleSave, isBusy, isDirty, isValid, resetToSavedTemplate, savedTemplate, setActions]);

  if (isLoading) return <TemplateSkeleton />;
  if (isError || !draft || !savedTemplate) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-destructive" role="alert">
          Unable to load the OIDC template. Check that the IAM API is available and try again.
        </CardContent>
      </Card>
    );
  }

  const previewTemplate: IOidcUiTemplate = {
    ...draft,
    branding: { ...draft.branding, logoUrl: previewLogoUrl },
  };
  const selectedPageFields = PAGE_FIELDS[selectedPage];
  const selectedPageValues = draft.pages[selectedPage] as unknown as Record<string, string | null>;

  const handleEditorTabChange = (value: string) => {
    const next = value as EditorTab;
    setEditorTab(next);
    if (next === "theme") setPreviewMode(paletteMode);
  };
  const handlePaletteChange = (value: string) => {
    const next = value as OidcPreviewTheme;
    setPaletteMode(next);
    setPreviewMode(next);
  };
  const handlePreviewModeChange = (mode: OidcPreviewThemeMode) => {
    if (mode === "system" && editorTab === "theme") return;
    setPreviewMode(mode);
    if (mode !== "system") setPaletteMode(mode);
  };

  return (
    <Card className="bg-background">
      <CardContent className="p-3 sm:p-5 lg:p-6">
        <div className="grid min-w-0 grid-cols-1 gap-5 xl:grid-cols-2 xl:gap-6">
          <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
            <Tabs value={editorTab} onValueChange={handleEditorTabChange}>
              <TabsList className="mb-5 grid w-full grid-cols-3" aria-label="Template sections">
                <TabsTrigger value="branding">Branding</TabsTrigger>
                <TabsTrigger value="theme">Theme</TabsTrigger>
                <TabsTrigger value="pages">Pages</TabsTrigger>
              </TabsList>

              <TabsContent value="branding" className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold">Branding</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Set the tenant name and logo.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand-name">
                    Brand name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="brand-name"
                    value={draft.branding.brandName}
                    maxLength={81}
                    onChange={(event) => updateBranding("brandName", event.target.value)}
                    aria-invalid={!!fieldError("branding.brandName")}
                  />
                  {fieldError("branding.brandName") && (
                    <p className="text-sm text-destructive" role="alert">
                      Brand name {fieldError("branding.brandName")}
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  <Label htmlFor="client-logo-upload">Client logo</Label>
                  <div
                    className={cn(
                      "flex flex-col items-center gap-4 rounded-lg border border-dashed p-5",
                      isDragOver ? "border-primary bg-primary/5" : "border-border bg-muted/20",
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
                    <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border bg-background">
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
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) applyLogoFile(file);
                      }}
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isBusy}
                      >
                        <Upload className="mr-2 h-4 w-4" /> Upload logo
                      </Button>
                      {previewLogoUrl && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={removeLogo}
                          disabled={isBusy}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> Remove logo
                        </Button>
                      )}
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      PNG, JPG, SVG, or WebP up to 2MB.
                    </p>
                  </div>
                  {(logoValidationMessage || fieldError("branding.logoUrl")) && (
                    <p className="text-sm text-destructive" role="alert">
                      Logo URL {logoValidationMessage || fieldError("branding.logoUrl")}
                    </p>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="theme" className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold">Theme</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Edit each preview palette independently.
                  </p>
                </div>
                <Tabs value={paletteMode} onValueChange={handlePaletteChange}>
                  <TabsList className="grid w-full grid-cols-2" aria-label="Theme palette">
                    <TabsTrigger value="light">Light</TabsTrigger>
                    <TabsTrigger value="dark">Dark</TabsTrigger>
                  </TabsList>
                  {(["light", "dark"] as const).map((mode) => (
                    <TabsContent
                      key={mode}
                      value={mode}
                      className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
                    >
                      {THEME_FIELDS.map(({ key, label }) => (
                        <ColorInput
                          key={key}
                          palette={mode}
                          field={key}
                          label={label}
                          value={draft.theme[mode][key]}
                          error={fieldError(`theme.${mode}.${key}`)}
                          onChange={(value) => updatePalette(mode, key, value)}
                        />
                      ))}
                    </TabsContent>
                  ))}
                </Tabs>
              </TabsContent>

              <TabsContent value="pages" className="space-y-5">
                <div>
                  <h2 className="text-base font-semibold">Pages</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose a page and edit its copy.
                  </p>
                </div>
                <div role="tablist" aria-label="OIDC page" className="flex flex-wrap gap-2">
                  {PAGE_OPTIONS.map(({ key, label }) => (
                    <Button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={selectedPage === key}
                      variant={selectedPage === key ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSelectedPage(key)}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {selectedPageFields.map(({ key, label, optional, multiline }) => {
                    const error = fieldError(`pages.${selectedPage}.${key}`);
                    const controlProps = {
                      id: `page-${selectedPage}-${key}`,
                      value: selectedPageValues[key] ?? "",
                      maxLength: 201,
                      "aria-invalid": !!error,
                      onChange: (
                        event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
                      ) =>
                        updatePage(
                          key,
                          optional && !event.target.value ? null : event.target.value,
                        ),
                    };
                    return (
                      <div key={key} className={cn("space-y-2", multiline && "sm:col-span-2")}>
                        <Label htmlFor={controlProps.id}>
                          {label}
                          {!optional && <span className="text-destructive"> *</span>}
                        </Label>
                        {multiline ? <Textarea {...controlProps} /> : <Input {...controlProps} />}
                        {error && (
                          <p className="text-xs text-destructive" role="alert">
                            {label} {error}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="space-y-2 border-t border-border pt-5">
                  <Label htmlFor="page-shared-footerText">
                    Footer <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="page-shared-footerText"
                    value={draft.pages.shared.footerText}
                    maxLength={201}
                    onChange={(event) => {
                      setDraft((current) =>
                        current
                          ? {
                              ...current,
                              pages: {
                                ...current.pages,
                                shared: { footerText: event.target.value },
                              },
                            }
                          : current,
                      );
                      clearServerFieldError("pages.shared.footerText");
                    }}
                    aria-invalid={!!fieldError("pages.shared.footerText")}
                  />
                  {fieldError("pages.shared.footerText") && (
                    <p className="text-xs text-destructive" role="alert">
                      Footer {fieldError("pages.shared.footerText")}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </section>

          <section className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-5">
            <div className="mb-4 border-b border-border pb-3">
              <h2 className="text-base font-semibold">Live Preview</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Unsaved changes appear here immediately.
              </p>
            </div>
            <OidcTemplatePreview
              template={previewTemplate}
              selectedPage={selectedPage}
              previewMode={previewMode}
              onPreviewModeChange={handlePreviewModeChange}
              showAuto={editorTab !== "theme"}
            />
          </section>
        </div>
      </CardContent>
    </Card>
  );
};

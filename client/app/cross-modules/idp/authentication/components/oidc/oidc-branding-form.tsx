import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Brush, FileText, ImagePlus, Moon, Palette, Sun, Trash2, Upload } from "lucide-react";
import { parseAsStringEnum, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
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

const EDITOR_TABS: Array<{
  value: EditorTab;
  label: string;
  Icon: typeof Brush;
}> = [
  { value: "branding", label: "Branding", Icon: Brush },
  { value: "theme", label: "Theme", Icon: Palette },
  { value: "pages", label: "Pages", Icon: FileText },
];

const EDITOR_TAB_VALUES = ["branding", "theme", "pages"] as const;
const PREVIEW_MODE_VALUES = ["system", "light", "dark"] as const;

const THEME_GROUPS: Array<{
  label: string;
  description: string;
  fields: Array<keyof IOidcUiThemePalette>;
}> = [
  {
    label: "Brand colors",
    description: "Core actions and subtle highlights.",
    fields: ["primary", "secondary", "accentSoft"],
  },
  {
    label: "Surfaces",
    description: "Canvas, cards, and structural borders.",
    fields: ["background", "surface", "border", "borderStrong"],
  },
  {
    label: "Content & status",
    description: "Typography and semantic feedback.",
    fields: ["text", "mutedText", "success", "danger"],
  },
];

const THEME_FIELD_DESCRIPTIONS: Record<keyof IOidcUiThemePalette, string> = {
  primary: "Primary actions",
  secondary: "Secondary accents",
  background: "Page canvas",
  surface: "Cards and panels",
  text: "Main content",
  mutedText: "Supporting content",
  success: "Success feedback",
  danger: "Errors and warnings",
  border: "Subtle dividers",
  borderStrong: "Emphasized outlines",
  accentSoft: "Tinted highlights",
};

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
  const rgba = value.match(/^rgba\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,/i);
  if (rgba) {
    return `#${rgba
      .slice(1, 4)
      .map((channel) => Math.min(255, Number(channel)).toString(16).padStart(2, "0"))
      .join("")}`;
  }
  return DEFAULT_COLOR;
};

const TemplateSkeleton = () => (
  <Card className="overflow-hidden rounded-xl bg-card p-0 shadow-sm">
    <CardContent>
      <div className="grid min-h-[34rem] min-w-0 grid-cols-1 xl:h-[calc(100dvh-10rem)] xl:max-h-[38rem] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex border-b xl:border-b-0 xl:border-r">
          <div className="hidden w-[5.5rem] shrink-0 space-y-2 border-r bg-muted/20 p-2 xl:block">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-[4.25rem] w-full rounded-lg" />
            ))}
          </div>
          <div className="flex-1 space-y-5 p-5">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        </section>
        <section className="flex items-center justify-center bg-muted/20 p-6">
          <Skeleton className="h-[460px] w-full max-w-xl rounded-xl" />
        </section>
      </div>
    </CardContent>
  </Card>
);

const ColorInput = ({
  palette,
  field,
  label,
  description,
  value,
  error,
  onChange,
}: {
  palette: OidcPreviewTheme;
  field: keyof IOidcUiThemePalette;
  label: string;
  description: string;
  value: string;
  error: string | null;
  onChange: (value: string) => void;
}) => {
  const id = `theme-${palette}-${field}`;
  const paletteLabel = palette === "light" ? "Light" : "Dark";
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2.5 transition-colors hover:border-primary/30",
          error && "border-destructive/60",
        )}
      >
        <div
          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          style={{ backgroundColor: value }}
        >
          <input
            id={`${id}-picker`}
            type="color"
            aria-label={`${paletteLabel} ${label} color picker`}
            value={colorPickerValue(value)}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>
        <div className="min-w-0 flex-1">
          <Label htmlFor={id} className="block truncate text-sm font-medium text-high-emphasis">
            {label} <span className="text-destructive">*</span>
          </Label>
          <p className="truncate text-xs text-muted-foreground">{description}</p>
        </div>
        <Input
          id={id}
          aria-label={`${paletteLabel} ${label}`}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={48}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
          className="h-8 w-[7.25rem] shrink-0 px-2 font-mono text-xs shadow-none"
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
  const [
    { section: editorTab, page: selectedPage, palette: paletteMode, preview: previewMode },
    setEditorState,
  ] = useQueryStates(
    {
      section: parseAsStringLiteral(EDITOR_TAB_VALUES).withDefault("branding"),
      page: parseAsStringEnum<OidcPageKey>(PAGE_OPTIONS.map(({ key }) => key)).withDefault("login"),
      palette: parseAsStringLiteral(["light", "dark"] as const).withDefault("light"),
      preview: parseAsStringLiteral(PREVIEW_MODE_VALUES).withDefault("system"),
    },
    { history: "replace" },
  );
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
    void setEditorState({
      section: next,
      ...(next === "theme" ? { preview: paletteMode } : {}),
    });
  };
  const handlePaletteChange = (value: string) => {
    const next = value as OidcPreviewTheme;
    void setEditorState({ palette: next, preview: next });
  };
  const handlePreviewModeChange = (mode: OidcPreviewThemeMode) => {
    if (mode === "system" && editorTab === "theme") return;
    void setEditorState({
      preview: mode,
      ...(mode !== "system" ? { palette: mode } : {}),
    });
  };

  const selectedPageLabel = PAGE_OPTIONS.find(({ key }) => key === selectedPage)?.label ?? "Login";

  return (
    <Card className="overflow-hidden rounded-xl bg-card p-0 shadow-sm">
      <CardContent>
        <Tabs
          value={editorTab}
          onValueChange={handleEditorTabChange}
          className="grid min-w-0 grid-cols-1 xl:h-[calc(100dvh-10rem)] xl:min-h-[34rem] xl:max-h-[38rem] xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <section className="flex min-h-0 min-w-0 flex-col border-b border-border bg-card xl:flex-row xl:border-b-0 xl:border-r">
            <div className="shrink-0 border-b border-border bg-muted/20 p-2 xl:w-[5.5rem] xl:border-b-0 xl:border-r">
              <TabsList
                className="grid h-auto w-full grid-cols-3 gap-1 rounded-lg bg-transparent p-0 xl:flex xl:h-full xl:flex-col xl:justify-start xl:gap-2"
                aria-label="Template sections"
              >
                {EDITOR_TABS.map(({ value, label, Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="h-11 gap-2 rounded-lg border border-transparent px-2 text-xs shadow-none hover:bg-background/60 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-sm xl:h-[4.25rem] xl:w-full xl:flex-col xl:gap-1.5 xl:px-1 xl:text-[11px]"
                  >
                    <Icon className="h-4 w-4 xl:h-[18px] xl:w-[18px]" aria-hidden />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <ScrollArea className="h-auto min-h-0 min-w-0 flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block xl:h-full">
              <div className="p-4 sm:p-5">
                <TabsContent value="branding" className="m-0 space-y-6">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground">
                      <Brush className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">Brand identity</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Add the name and logo users will recognize.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="brand-name">
                      Brand name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="brand-name"
                      value={draft.branding.brandName}
                      maxLength={80}
                      onChange={(event) => updateBranding("brandName", event.target.value)}
                      aria-invalid={!!fieldError("branding.brandName")}
                      className="shadow-none"
                    />
                    <div className="flex items-start justify-between gap-3">
                      {fieldError("branding.brandName") ? (
                        <p className="text-xs text-destructive" role="alert">
                          Brand name {fieldError("branding.brandName")}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          Displayed beside your logo on authentication pages.
                        </p>
                      )}
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {draft.branding.brandName.length}/80
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label htmlFor="client-logo-upload">Brand logo</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Use a transparent, horizontal logo for the best result.
                      </p>
                    </div>
                    <div
                      className={cn(
                        "group rounded-xl border border-dashed p-4 transition-colors",
                        isDragOver
                          ? "border-primary bg-primary/5"
                          : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30",
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
                      <div className="flex flex-col items-center gap-4 sm:flex-row">
                        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background shadow-sm">
                          {previewLogoUrl ? (
                            <img
                              src={previewLogoUrl}
                              alt="Logo preview"
                              className="max-h-full max-w-full object-contain p-2"
                            />
                          ) : (
                            <ImagePlus className="h-7 w-7 text-muted-foreground" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 text-center sm:text-left">
                          <p className="text-sm font-medium text-high-emphasis">
                            {previewLogoUrl ? "Replace your logo" : "Drop your logo here"}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            PNG, JPG, SVG, or WebP · max 2MB
                          </p>
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
                          <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                            <Button
                              type="button"
                              variant="outline"
                              size="xs"
                              onClick={() => fileInputRef.current?.click()}
                              disabled={isBusy}
                              className="gap-1.5 shadow-none"
                            >
                              <Upload className="h-3.5 w-3.5" />
                              {previewLogoUrl ? "Replace" : "Browse files"}
                            </Button>
                            {previewLogoUrl && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                onClick={removeLogo}
                                disabled={isBusy}
                                className="gap-1.5 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Remove logo
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                    {(logoValidationMessage || fieldError("branding.logoUrl")) && (
                      <p className="text-xs text-destructive" role="alert">
                        Logo URL {logoValidationMessage || fieldError("branding.logoUrl")}
                      </p>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="theme" className="m-0 space-y-6">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground">
                      <Palette className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">Color system</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Fine-tune accessible colors for both appearances.
                      </p>
                    </div>
                  </div>
                  <Tabs value={paletteMode} onValueChange={handlePaletteChange}>
                    <TabsList
                      className="grid h-11 w-full grid-cols-2 gap-1 rounded-lg bg-muted/40 p-1"
                      aria-label="Theme palette"
                    >
                      <TabsTrigger
                        value="light"
                        className="h-9 gap-2 rounded-md text-xs shadow-none data-[state=active]:shadow-sm sm:text-sm"
                      >
                        <Sun className="h-4 w-4" aria-hidden /> Light
                      </TabsTrigger>
                      <TabsTrigger
                        value="dark"
                        className="h-9 gap-2 rounded-md text-xs shadow-none data-[state=active]:shadow-sm sm:text-sm"
                      >
                        <Moon className="h-4 w-4" aria-hidden /> Dark
                      </TabsTrigger>
                    </TabsList>
                    {(["light", "dark"] as const).map((mode) => (
                      <TabsContent key={mode} value={mode} className="mt-5 space-y-5">
                        {THEME_GROUPS.map((group) => (
                          <section key={group.label}>
                            <div className="mb-2 flex items-end justify-between gap-3">
                              <div>
                                <h3 className="text-xs font-semibold uppercase tracking-wide text-high-emphasis">
                                  {group.label}
                                </h3>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                  {group.description}
                                </p>
                              </div>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {group.fields.length} tokens
                              </span>
                            </div>
                            <div className="space-y-2">
                              {group.fields.map((key) => {
                                const field = THEME_FIELDS.find((item) => item.key === key);
                                if (!field) return null;
                                return (
                                  <ColorInput
                                    key={key}
                                    palette={mode}
                                    field={key}
                                    label={field.label}
                                    description={THEME_FIELD_DESCRIPTIONS[key]}
                                    value={draft.theme[mode][key]}
                                    error={fieldError(`theme.${mode}.${key}`)}
                                    onChange={(value) => updatePalette(mode, key, value)}
                                  />
                                );
                              })}
                            </div>
                          </section>
                        ))}
                      </TabsContent>
                    ))}
                  </Tabs>
                </TabsContent>

                <TabsContent value="pages" className="m-0 space-y-6">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground">
                      <FileText className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">Page content</h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Customize labels and messages for each step.
                      </p>
                    </div>
                  </div>
                  <div className="w-full overflow-x-auto pb-2 [scrollbar-width:thin]">
                    <div
                      role="tablist"
                      aria-label="OIDC page"
                      className="flex w-max gap-1 rounded-lg bg-muted/50 p-1"
                    >
                      {PAGE_OPTIONS.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={selectedPage === key}
                          className={cn(
                            "rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            selectedPage === key
                              ? "bg-background text-high-emphasis shadow-sm"
                              : "text-muted-foreground hover:bg-background/60 hover:text-high-emphasis",
                          )}
                          onClick={() => void setEditorState({ page: key })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div>
                      <p className="text-sm font-medium text-high-emphasis">{selectedPageLabel}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {selectedPageFields.length} editable fields
                      </p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      Live
                    </span>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-4">
                    {selectedPageFields.map(({ key, label, optional, multiline }) => {
                      const error = fieldError(`pages.${selectedPage}.${key}`);
                      const controlProps = {
                        id: `page-${selectedPage}-${key}`,
                        value: selectedPageValues[key] ?? "",
                        maxLength: 200,
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
                        <div key={key} className="min-w-0 space-y-1.5">
                          <Label htmlFor={controlProps.id} className="text-xs">
                            {label}
                            {!optional && <span className="text-destructive"> *</span>}
                          </Label>
                          {multiline ? (
                            <Textarea {...controlProps} className="min-h-24 resize-y shadow-none" />
                          ) : (
                            <Input {...controlProps} className="shadow-none" />
                          )}
                          {error && (
                            <p className="text-xs text-destructive" role="alert">
                              {label} {error}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1.5 rounded-lg border border-border bg-muted/20 p-3">
                    <Label htmlFor="page-shared-footerText" className="text-xs">
                      Footer <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="page-shared-footerText"
                      value={draft.pages.shared.footerText}
                      maxLength={200}
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
                      className="bg-background shadow-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      Shared by every page. Use {"{year}"} for the current year.
                    </p>
                    {fieldError("pages.shared.footerText") && (
                      <p className="text-xs text-destructive" role="alert">
                        Footer {fieldError("pages.shared.footerText")}
                      </p>
                    )}
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </section>

          <section className="flex min-h-0 min-w-0 flex-col bg-muted/20">
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-high-emphasis">Live preview</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {selectedPageLabel} page · updates instantly
                </p>
              </div>
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                  isDirty
                    ? "border-warning-200 bg-warning-50 text-warning-700"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    isDirty ? "bg-warning-500" : "bg-success",
                  )}
                  aria-hidden
                />
                {isDirty ? "Unsaved" : "Saved"}
              </div>
            </div>
            <div className="flex min-h-[500px] flex-1 items-center justify-center p-2 sm:p-3 xl:min-h-0 xl:p-2">
              <div className="h-full max-h-full w-full max-w-[38rem] overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <OidcTemplatePreview
                  template={previewTemplate}
                  selectedPage={selectedPage}
                  previewMode={previewMode}
                  onPreviewModeChange={handlePreviewModeChange}
                  showAuto={editorTab !== "theme"}
                />
              </div>
            </div>
          </section>
        </Tabs>
      </CardContent>
    </Card>
  );
};

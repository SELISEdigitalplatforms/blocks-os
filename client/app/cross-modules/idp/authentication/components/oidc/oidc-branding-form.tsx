import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Brush,
  FileText,
  ImagePlus,
  Loader2,
  Moon,
  Palette,
  PanelRight,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { parseAsStringEnum, parseAsStringLiteral, useQueryStates } from "nuqs";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Input } from "@/components/ui-kits/input/input";
import { Label } from "@/components/ui-kits/label/label";
import { ScrollArea } from "@/components/ui-kits/scroll-area/scroll-area";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { Switch } from "@/components/ui-kits/switch/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui-kits/tabs/tabs";
import { Textarea } from "@/components/ui-kits/textarea/textarea";
import { ModuleName } from "@/constants/modules.constants";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { isErrorWithErrors } from "@/lib/error";
import { cn } from "@/lib/utils";
import { useGetAuthConfig } from "@blocks-idp/authentication/hooks/use-auth-config";
import { useOidcBrandingHeader } from "@blocks-idp/authentication/contexts/oidc-branding-header-context";
import {
  useGetOidcTemplate,
  useSaveOidcTemplate,
} from "@blocks-idp/authentication/hooks/use-oidc-template";
import type {
  IOidcUiTemplate,
  IOidcUiThemePalette,
} from "@blocks-idp/authentication/models/auth.oidc.model";
import {
  useCompleteUpload,
  useGetPreSignedUrlForUpload,
  useUploadFile,
} from "@blocks-storage/hooks/use-storage-file";
import { storageService } from "@blocks-storage/services/storage.service";
import { tStatic, useProjectStore, useT } from "@seliseblocks/genesis-os";
import { OidcTemplatePreview } from "./oidc-template-preview";
import { DEFAULT_OIDC_UI_TEMPLATE, normalizeOidcUiTemplate } from "./oidc-template-defaults";
import {
  getPageFields,
  getPageOptions,
  getThemeFields,
  type OidcPageKey,
  validateOidcUiTemplate,
} from "./oidc-template-validation";
import type { OidcPreviewTheme, OidcPreviewThemeMode } from "./oidc-preview-shared";

const KEY_FIELD_ERROR = "OIDC_BRANDING_FORM.FIELD_ERROR";

const I18N_MODULE = "os.idp.oidc";

const DEFAULT_COLOR = "#0066b2";
const MAX_LOGO_SIZE_MB = 2;
const ALLOWED_LOGO_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/svg+xml", "image/webp"];

type EditorTab = "branding" | "theme" | "pages" | "layout";

const getEditorTabs = (): Array<{
  value: EditorTab;
  label: string;
  Icon: typeof Brush;
}> => [
  {
    value: "branding",
    label: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.TAB_BRANDING"),
    Icon: Brush,
  },
  { value: "theme", label: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.TAB_THEME"), Icon: Palette },
  { value: "pages", label: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.TAB_PAGES"), Icon: FileText },
  {
    value: "layout",
    label: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.TAB_LAYOUT"),
    Icon: PanelRight,
  },
];

const EDITOR_TAB_VALUES = ["branding", "theme", "pages", "layout"] as const;
const PREVIEW_MODE_VALUES = ["system", "light", "dark"] as const;

const getThemeGroups = (): Array<{
  id: string;
  label: string;
  description: string;
  fields: Array<keyof IOidcUiThemePalette>;
}> => [
  {
    id: "brand",
    label: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.GROUP_BRAND_COLORS"),
    description: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.GROUP_BRAND_COLORS_DESC"),
    fields: ["primary", "secondary", "accentSoft"],
  },
  {
    id: "surfaces",
    label: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.GROUP_SURFACES"),
    description: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.GROUP_SURFACES_DESC"),
    fields: ["background", "surface", "border", "borderStrong"],
  },
  {
    id: "content",
    label: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.GROUP_CONTENT_STATUS"),
    description: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.GROUP_CONTENT_STATUS_DESC"),
    fields: ["text", "mutedText", "success", "danger"],
  },
  {
    id: "buttons",
    label: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.GROUP_BUTTONS"),
    description: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.GROUP_BUTTONS_DESC"),
    fields: ["buttonText"],
  },
];

const getThemeFieldDescriptions = (): Record<keyof IOidcUiThemePalette, string> => ({
  primary: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_PRIMARY"),
  secondary: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_SECONDARY"),
  background: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_BACKGROUND"),
  surface: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_SURFACE"),
  text: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_TEXT"),
  mutedText: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_MUTED_TEXT"),
  success: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_SUCCESS"),
  danger: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_DANGER"),
  border: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_BORDER"),
  borderStrong: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_BORDER_STRONG"),
  accentSoft: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_ACCENT_SOFT"),
  buttonText: tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.THEME_DESC_BUTTON_TEXT"),
});

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
  <Card className="overflow-hidden rounded-xl bg-card p-0 shadow-xs">
    <CardContent>
      <div className="grid min-h-136 min-w-0 grid-cols-1 xl:h-[calc(100dvh-10rem)] xl:max-h-184 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="flex border-b xl:border-b-0 xl:border-r">
          <div className="hidden w-22 shrink-0 space-y-2 border-r bg-muted/20 p-2 xl:block">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-17 w-full rounded-lg" />
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
  const { t } = useT(I18N_MODULE);
  const id = `theme-${palette}-${field}`;
  const paletteLabel =
    palette === "light" ? t("OIDC_BRANDING_FORM.LIGHT") : t("OIDC_BRANDING_FORM.DARK");
  return (
    <div className="space-y-1">
      <div
        className={cn(
          "flex min-w-0 items-center gap-3 rounded-lg border bg-background px-3 py-2.5 transition-colors hover:border-primary/30",
          error && "border-destructive/60",
        )}
      >
        <div
          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-border shadow-xs ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
          style={{ backgroundColor: value }}
        >
          <input
            id={`${id}-picker`}
            type="color"
            aria-label={t("OIDC_BRANDING_FORM.COLOR_PICKER_LABEL", {
              palette: paletteLabel,
              label,
            })}
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
          className="h-8 w-29 shrink-0 px-2 font-mono text-xs shadow-none"
        />
      </div>
      {error && (
        <p id={`${id}-error`} className="text-xs text-destructive" role="alert">
          {t("OIDC_BRANDING_FORM.COLOR_ERROR", { palette: paletteLabel, label, error })}
        </p>
      )}
    </div>
  );
};

/**
 * One mode's logo drop zone - light and dark each get their own independent slot
 * (their own file, their own preview, their own remove action), rendered twice by
 * the branding tab below.
 */
const LogoUploadField = ({
  inputId,
  label,
  previewUrl,
  isDragOver,
  isBusy,
  error,
  fileInputRef,
  onDragOverChange,
  onFile,
  onRemove,
}: {
  inputId: string;
  label: string;
  previewUrl: string | null;
  isDragOver: boolean;
  isBusy: boolean;
  error: string | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onDragOverChange: (isDragOver: boolean) => void;
  onFile: (file: File) => void;
  onRemove: () => void;
}) => {
  const { t } = useT(I18N_MODULE);
  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>{label}</Label>
      <div
        className={cn(
          "group rounded-xl border border-dashed p-4 transition-colors",
          isDragOver
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/20 hover:border-primary/50 hover:bg-muted/30",
        )}
        onDragOver={(event) => {
          event.preventDefault();
          onDragOverChange(true);
        }}
        onDragLeave={() => onDragOverChange(false)}
        onDrop={(event) => {
          event.preventDefault();
          onDragOverChange(false);
          const file = event.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background shadow-xs">
            {previewUrl ? (
              <img
                src={previewUrl}
                alt={t("OIDC_BRANDING_FORM.LOGO_PREVIEW_ALT")}
                className="max-h-full max-w-full object-contain p-2"
              />
            ) : (
              <ImagePlus className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
          <div className="min-w-0 text-center">
            <p className="text-xs font-medium text-high-emphasis">
              {previewUrl
                ? t("OIDC_BRANDING_FORM.LOGO_REPLACE_HINT")
                : t("OIDC_BRANDING_FORM.LOGO_DROP_HINT")}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              {t("OIDC_BRANDING_FORM.LOGO_FORMATS", { size: MAX_LOGO_SIZE_MB })}
            </p>
            <input
              id={inputId}
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) onFile(file);
              }}
            />
            <div className="mt-2.5 flex flex-wrap justify-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={isBusy}
                className="gap-1.5 shadow-none"
              >
                <Upload className="h-3.5 w-3.5" />
                {previewUrl
                  ? t("OIDC_BRANDING_FORM.LOGO_REPLACE")
                  : t("OIDC_BRANDING_FORM.LOGO_BROWSE")}
              </Button>
              {previewUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  onClick={onRemove}
                  disabled={isBusy}
                  className="gap-1.5 px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" /> {t("OIDC_BRANDING_FORM.LOGO_REMOVE")}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {t(KEY_FIELD_ERROR, { label, error })}
        </p>
      )}
    </div>
  );
};

export const OidcBrandingForm = () => {
  const { t, language } = useT(I18N_MODULE);
  const fileInputRefLight = useRef<HTMLInputElement>(null);
  const fileInputRefDark = useRef<HTMLInputElement>(null);
  const { setActions } = useOidcBrandingHeader();
  const tenantId = useProjectStore().selectedProject?.tenantId || "";
  const { data: template, isLoading, isError } = useGetOidcTemplate();
  // The activation preview drops its password fields when the tenant has turned that
  // step off, so what is previewed matches what users are served.
  const { data: authConfig } = useGetAuthConfig({ projectKey: tenantId });
  const { mutateAsync: saveTemplate, isPending: isSaving } = useSaveOidcTemplate();
  const { mutateAsync: getPresignedUrl } = useGetPreSignedUrlForUpload();
  const { mutateAsync: uploadFile } = useUploadFile();
  const { mutateAsync: completeUpload } = useCompleteUpload();

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
      page: parseAsStringEnum<OidcPageKey>(getPageOptions().map(({ key }) => key)).withDefault(
        "signup",
      ),
      palette: parseAsStringLiteral(["light", "dark"] as const).withDefault("light"),
      preview: parseAsStringLiteral(PREVIEW_MODE_VALUES).withDefault("system"),
    },
    { history: "replace" },
  );
  const [pendingLogoFiles, setPendingLogoFiles] = useState<Record<OidcPreviewTheme, File | null>>({
    light: null,
    dark: null,
  });
  const [previewLogoUrls, setPreviewLogoUrls] = useState<Record<OidcPreviewTheme, string | null>>({
    light: normalizedTemplate?.branding.logoUrlLight ?? null,
    dark: normalizedTemplate?.branding.logoUrlDark ?? null,
  });
  const [logoValidationMessages, setLogoValidationMessages] = useState<
    Record<OidcPreviewTheme, string | null>
  >({ light: null, dark: null });
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState<Record<OidcPreviewTheme, boolean>>({
    light: false,
    dark: false,
  });
  // Which single page is mid-save via its own "Save page" button - distinct from the
  // header's whole-template `isSaving`, so saving one page never disables another.
  const [savingPageKey, setSavingPageKey] = useState<OidcPageKey | null>(null);

  const [previousTemplate, setPreviousTemplate] = useState(sourceTemplate);
  if (sourceTemplate !== previousTemplate) {
    setPreviousTemplate(sourceTemplate);
    const next = normalizedTemplate;
    setSavedTemplate(next);
    setDraft(next);
    setPreviewLogoUrls({
      light: next?.branding.logoUrlLight ?? null,
      dark: next?.branding.logoUrlDark ?? null,
    });
    setPendingLogoFiles({ light: null, dark: null });
    setLogoValidationMessages({ light: null, dark: null });
    setServerErrors({});
  }

  useEffect(
    () => () => {
      if (previewLogoUrls.light?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrls.light);
      if (previewLogoUrls.dark?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrls.dark);
    },
    [previewLogoUrls.light, previewLogoUrls.dark],
  );

  const clearServerFieldError = useCallback((field: string) => {
    setServerErrors((current) =>
      Object.fromEntries(
        Object.entries(current).filter(([key]) => normalizeField(key) !== normalizeField(field)),
      ),
    );
  }, []);

  const updateBranding = (
    field: "brandName" | "logoUrlLight" | "logoUrlDark",
    value: string | null,
  ) => {
    setDraft((current) =>
      current ? { ...current, branding: { ...current.branding, [field]: value } } : current,
    );
    clearServerFieldError(`branding.${field}`);
  };

  const updateLayout = (showAnimationPanel: boolean) => {
    setDraft((current) => (current ? { ...current, layout: { showAnimationPanel } } : current));
    clearServerFieldError("layout.showAnimationPanel");
  };

  /** Each preview mode's logo lives under its own field name on `branding`. */
  const logoFieldKey = (mode: OidcPreviewTheme): "logoUrlLight" | "logoUrlDark" =>
    mode === "light" ? "logoUrlLight" : "logoUrlDark";

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

  const applyLogoFile = (mode: OidcPreviewTheme, file: File) => {
    if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
      showErrorToast({ errors: t("OIDC_BRANDING_FORM.ERROR_LOGO_TYPE") });
      return;
    }
    if (file.size > MAX_LOGO_SIZE_MB * 1024 * 1024) {
      showErrorToast({
        errors: t("OIDC_BRANDING_FORM.ERROR_LOGO_SIZE", { size: MAX_LOGO_SIZE_MB }),
      });
      return;
    }
    setPreviewLogoUrls((current) => {
      if (current[mode]?.startsWith("blob:")) URL.revokeObjectURL(current[mode]!);
      return { ...current, [mode]: URL.createObjectURL(file) };
    });
    setPendingLogoFiles((current) => ({ ...current, [mode]: file }));
    setLogoValidationMessages((current) => ({ ...current, [mode]: null }));
    clearServerFieldError(`branding.${logoFieldKey(mode)}`);
  };

  const removeLogo = (mode: OidcPreviewTheme) => {
    setPreviewLogoUrls((current) => {
      if (current[mode]?.startsWith("blob:")) URL.revokeObjectURL(current[mode]!);
      return { ...current, [mode]: null };
    });
    setPendingLogoFiles((current) => ({ ...current, [mode]: null }));
    setLogoValidationMessages((current) => ({ ...current, [mode]: null }));
    updateBranding(logoFieldKey(mode), null);
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
      if (response.uploadCompletionRequired) {
        const completion = await completeUpload({
          fileId: response.fileId,
          fileVersionId: response.fileVersionId ?? "",
        });
        if (completion.verificationStatus !== "Verified") {
          throw new Error(
            completion.rejectionReason ??
              tStatic(I18N_MODULE, "OIDC_BRANDING_FORM.LOGO_FAILED_VERIFICATION"),
          );
        }
      }
      const fileRecord = await storageService.file.getFileByFileId({
        itemId: response.fileId,
        projectKey: tenantId,
      });
      return fileRecord.url;
    },
    [completeUpload, getPresignedUrl, tenantId, uploadFile],
  );

  // `language` is a dependency so the messages are rebuilt when the language changes.
  const validationErrors = useMemo(
    () => (draft ? validateOidcUiTemplate(draft) : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [draft, language],
  );
  const fieldError = (field: string) =>
    validationErrors[field] ?? getServerFieldError(serverErrors, field);
  const isValid =
    Object.keys(validationErrors).length === 0 &&
    !logoValidationMessages.light &&
    !logoValidationMessages.dark;
  const isDirty = useMemo(
    () =>
      !!draft &&
      !!savedTemplate &&
      (JSON.stringify(draft) !== JSON.stringify(savedTemplate) ||
        !!pendingLogoFiles.light ||
        !!pendingLogoFiles.dark),
    [draft, pendingLogoFiles, savedTemplate],
  );
  const isBusy = isSaving || isUploading;

  const resetToSavedTemplate = useCallback(() => {
    if (!savedTemplate) return;
    if (previewLogoUrls.light?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrls.light);
    if (previewLogoUrls.dark?.startsWith("blob:")) URL.revokeObjectURL(previewLogoUrls.dark);
    const restored = structuredClone(savedTemplate);
    setDraft(restored);
    setPreviewLogoUrls({
      light: restored.branding.logoUrlLight,
      dark: restored.branding.logoUrlDark,
    });
    setPendingLogoFiles({ light: null, dark: null });
    setLogoValidationMessages({ light: null, dark: null });
    setServerErrors({});
  }, [previewLogoUrls.light, previewLogoUrls.dark, savedTemplate]);

  const handleSave = useCallback(async () => {
    if (!draft || !isValid) return;
    try {
      setIsUploading(true);
      setServerErrors({});
      const payload = structuredClone(draft);
      if (pendingLogoFiles.light) {
        payload.branding.logoUrlLight = await uploadLogoToStorage(pendingLogoFiles.light);
      }
      if (pendingLogoFiles.dark) {
        payload.branding.logoUrlDark = await uploadLogoToStorage(pendingLogoFiles.dark);
      }

      const uploadedErrors = validateOidcUiTemplate(payload);
      const uploadErrorLight = uploadedErrors["branding.logoUrlLight"];
      const uploadErrorDark = uploadedErrors["branding.logoUrlDark"];
      if (uploadErrorLight || uploadErrorDark) {
        setLogoValidationMessages({
          light: uploadErrorLight ?? null,
          dark: uploadErrorDark ?? null,
        });
        return;
      }

      const response = await saveTemplate(payload);
      if (!response.isSuccess) {
        const errors = response.errors ?? { Template: t("OIDC_BRANDING_FORM.ERROR_SAVE_TEMPLATE") };
        setServerErrors(errors);
        showErrorToast({ errors });
        return;
      }

      showSuccessToast({ description: t("OIDC_BRANDING_FORM.TOAST_TEMPLATE_SAVED") });
      setSavedTemplate(payload);
      setDraft(payload);
      setPendingLogoFiles({ light: null, dark: null });
      setPreviewLogoUrls((current) => {
        if (current.light?.startsWith("blob:")) URL.revokeObjectURL(current.light);
        if (current.dark?.startsWith("blob:")) URL.revokeObjectURL(current.dark);
        return { light: payload.branding.logoUrlLight, dark: payload.branding.logoUrlDark };
      });
      setLogoValidationMessages({ light: null, dark: null });
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
        showErrorToast({ errors: t("OIDC_BRANDING_FORM.ERROR_SAVE_TEMPLATE") });
      }
    } finally {
      setIsUploading(false);
    }
  }, [draft, isValid, pendingLogoFiles, saveTemplate, t, uploadLogoToStorage]);

  /**
   * Saves exactly one page (plus the shared footer fields shown alongside every page)
   * without touching branding, theme, or any other page's in-progress edits - those
   * stay in `draft`, still unsaved, exactly as the admin left them. Everything else in
   * the payload comes from `savedTemplate`, the last known-good template, so an invalid
   * draft elsewhere (a half-finished Theme edit, say) can never block this save.
   */
  const handleSavePage = useCallback(
    async (pageKey: OidcPageKey) => {
      if (!draft || !savedTemplate) return;
      const payload: IOidcUiTemplate = {
        ...savedTemplate,
        pages: {
          ...savedTemplate.pages,
          [pageKey]: draft.pages[pageKey],
          shared: draft.pages.shared,
        },
      };
      const hasPageError = Object.keys(validateOidcUiTemplate(payload)).some(
        (key) => key.startsWith(`pages.${pageKey}.`) || key.startsWith("pages.shared."),
      );
      if (hasPageError) return;

      setSavingPageKey(pageKey);
      try {
        const response = await saveTemplate(payload);
        if (!response.isSuccess) {
          const errors = response.errors ?? { Template: t("OIDC_BRANDING_FORM.ERROR_SAVE_PAGE") };
          setServerErrors((current) => ({ ...current, ...errors }));
          showErrorToast({ errors });
          return;
        }

        const pageLabel =
          getPageOptions().find(({ key }) => key === pageKey)?.label ??
          t("OIDC_BRANDING_FORM.PAGE_FALLBACK");
        showSuccessToast({
          description: t("OIDC_BRANDING_FORM.TOAST_PAGE_SAVED", { page: pageLabel }),
        });
        setSavedTemplate(payload);
      } catch (error) {
        if (isErrorWithErrors(error)) {
          const errors = Object.fromEntries(
            Object.entries(error.errors).map(([key, value]) => [
              key,
              Array.isArray(value) ? value.join(", ") : value,
            ]),
          );
          setServerErrors((current) => ({ ...current, ...errors }));
          showErrorToast({ errors: error.errors });
        } else {
          showErrorToast({ errors: t("OIDC_BRANDING_FORM.ERROR_SAVE_PAGE") });
        }
      } finally {
        setSavingPageKey(null);
      }
    },
    [draft, savedTemplate, saveTemplate, t],
  );

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
          {t("OIDC_BRANDING_FORM.LOAD_ERROR")}
        </CardContent>
      </Card>
    );
  }

  const previewTemplate: IOidcUiTemplate = {
    ...draft,
    branding: {
      ...draft.branding,
      logoUrlLight: previewLogoUrls.light,
      logoUrlDark: previewLogoUrls.dark,
    },
  };
  const pageOptions = getPageOptions();
  const selectedPageFields = getPageFields()[selectedPage];
  const selectedPageValues = draft.pages[selectedPage] as unknown as Record<string, string | null>;
  // Scoped to just this page (+ the shared footer fields shown alongside it), so an
  // unrelated draft problem elsewhere never blocks or falsely flags this page's own
  // "Save page" button.
  const isSelectedPageDirty =
    JSON.stringify(draft.pages[selectedPage]) !==
      JSON.stringify(savedTemplate.pages[selectedPage]) ||
    JSON.stringify(draft.pages.shared) !== JSON.stringify(savedTemplate.pages.shared);
  const isSelectedPageValid = !Object.keys(validationErrors).some(
    (key) => key.startsWith(`pages.${selectedPage}.`) || key.startsWith("pages.shared."),
  );
  const isSavingSelectedPage = savingPageKey === selectedPage;

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

  const selectedPageLabel =
    pageOptions.find(({ key }) => key === selectedPage)?.label ??
    t("OIDC_BRANDING_FORM.PAGE_SIGNUP_FALLBACK");
  const editorTabs = getEditorTabs();
  const themeGroups = getThemeGroups();
  const themeFieldDescriptions = getThemeFieldDescriptions();
  const themeFields = getThemeFields();
  const renderPaletteField = (mode: OidcPreviewTheme, key: keyof IOidcUiThemePalette) => {
    const field = themeFields.find((item) => item.key === key);
    if (!field) return null;
    return (
      <ColorInput
        key={key}
        palette={mode}
        field={key}
        label={field.label}
        description={themeFieldDescriptions[key]}
        value={draft.theme[mode][key]}
        error={fieldError(`theme.${mode}.${key}`)}
        onChange={(value) => updatePalette(mode, key, value)}
      />
    );
  };
  const sharedFields = [
    { key: "helpPrompt", label: t("OIDC_BRANDING_FORM.SHARED_HELP_PROMPT") },
    { key: "supportLinkText", label: t("OIDC_BRANDING_FORM.SHARED_SUPPORT_LINK_TEXT") },
  ];

  return (
    <Card className="overflow-hidden rounded-xl bg-card p-0 shadow-xs">
      <CardContent>
        <Tabs
          value={editorTab}
          onValueChange={handleEditorTabChange}
          className="grid min-w-0 grid-cols-1 xl:h-[calc(100dvh-10rem)] xl:min-h-136 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
        >
          <section className="flex min-h-0 min-w-0 flex-col border-b border-border bg-card xl:flex-row xl:border-b-0 xl:border-r">
            <div className="shrink-0 border-b border-border bg-muted/20 p-2 xl:w-22 xl:border-b-0 xl:border-r">
              <TabsList
                className="grid h-auto w-full grid-cols-4 gap-1 rounded-lg bg-transparent p-0 xl:flex xl:h-full xl:flex-col xl:justify-start xl:gap-2"
                aria-label={t("OIDC_BRANDING_FORM.SECTIONS_LABEL")}
              >
                {editorTabs.map(({ value, label, Icon }) => (
                  <TabsTrigger
                    key={value}
                    value={value}
                    className="h-11 gap-2 rounded-lg border border-transparent px-2 text-xs shadow-none hover:bg-background/60 data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-primary data-[state=active]:shadow-xs xl:h-17 xl:w-full xl:flex-col xl:gap-1.5 xl:px-1 xl:text-[11px]"
                  >
                    <Icon className="h-4 w-4 xl:h-[18px] xl:w-[18px]" aria-hidden />
                    {label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>

            <ScrollArea className="h-auto min-h-0 min-w-0 flex-1 [&>[data-radix-scroll-area-viewport]>div]:block! xl:h-full">
              <div className="p-4 sm:p-5">
                <TabsContent value="branding" className="m-0 space-y-6">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground">
                      <Brush className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">
                        {t("OIDC_BRANDING_FORM.BRAND_IDENTITY_TITLE")}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {t("OIDC_BRANDING_FORM.BRAND_IDENTITY_DESC")}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="brand-name">
                      {t("OIDC_BRANDING_FORM.BRAND_NAME")}{" "}
                      <span className="text-destructive">*</span>
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
                          {t("OIDC_BRANDING_FORM.BRAND_NAME_ERROR", {
                            error: fieldError("branding.brandName"),
                          })}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground">
                          {t("OIDC_BRANDING_FORM.BRAND_NAME_HINT")}
                        </p>
                      )}
                      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                        {draft.branding.brandName.length}/80
                      </span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <Label>{t("OIDC_BRANDING_FORM.BRAND_LOGOS")}</Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {t("OIDC_BRANDING_FORM.BRAND_LOGOS_HINT")}
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <LogoUploadField
                        inputId="client-logo-upload-light"
                        label={t("OIDC_BRANDING_FORM.LOGO_LIGHT")}
                        previewUrl={previewLogoUrls.light}
                        isDragOver={isDragOver.light}
                        isBusy={isBusy}
                        error={logoValidationMessages.light || fieldError("branding.logoUrlLight")}
                        fileInputRef={fileInputRefLight}
                        onDragOverChange={(value) =>
                          setIsDragOver((current) => ({ ...current, light: value }))
                        }
                        onFile={(file) => applyLogoFile("light", file)}
                        onRemove={() => removeLogo("light")}
                      />
                      <LogoUploadField
                        inputId="client-logo-upload-dark"
                        label={t("OIDC_BRANDING_FORM.LOGO_DARK")}
                        previewUrl={previewLogoUrls.dark}
                        isDragOver={isDragOver.dark}
                        isBusy={isBusy}
                        error={logoValidationMessages.dark || fieldError("branding.logoUrlDark")}
                        fileInputRef={fileInputRefDark}
                        onDragOverChange={(value) =>
                          setIsDragOver((current) => ({ ...current, dark: value }))
                        }
                        onFile={(file) => applyLogoFile("dark", file)}
                        onRemove={() => removeLogo("dark")}
                      />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="theme" className="m-0 space-y-6">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground">
                      <Palette className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">
                        {t("OIDC_BRANDING_FORM.COLOR_SYSTEM_TITLE")}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {t("OIDC_BRANDING_FORM.COLOR_SYSTEM_DESC")}
                      </p>
                    </div>
                  </div>
                  <Tabs value={paletteMode} onValueChange={handlePaletteChange}>
                    <TabsList
                      className="grid h-11 w-full grid-cols-2 gap-1 rounded-lg bg-muted/40 p-1"
                      aria-label={t("OIDC_BRANDING_FORM.PALETTE_LABEL")}
                    >
                      <TabsTrigger
                        value="light"
                        className="h-9 gap-2 rounded-md text-xs shadow-none data-[state=active]:shadow-xs sm:text-sm"
                      >
                        <Sun className="h-4 w-4" aria-hidden /> {t("OIDC_BRANDING_FORM.LIGHT")}
                      </TabsTrigger>
                      <TabsTrigger
                        value="dark"
                        className="h-9 gap-2 rounded-md text-xs shadow-none data-[state=active]:shadow-xs sm:text-sm"
                      >
                        <Moon className="h-4 w-4" aria-hidden /> {t("OIDC_BRANDING_FORM.DARK")}
                      </TabsTrigger>
                    </TabsList>
                    {(["light", "dark"] as const).map((mode) => (
                      <TabsContent key={mode} value={mode} className="mt-5 space-y-5">
                        {themeGroups.map((group) => (
                          <section key={group.id}>
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
                                {t("OIDC_BRANDING_FORM.TOKEN_COUNT", {
                                  count: group.fields.length,
                                })}
                              </span>
                            </div>
                            <div className="space-y-2">
                              {group.fields.map((key) => renderPaletteField(mode, key))}
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
                      <h2 className="text-base font-semibold">
                        {t("OIDC_BRANDING_FORM.PAGE_CONTENT_TITLE")}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {t("OIDC_BRANDING_FORM.PAGE_CONTENT_DESC")}
                      </p>
                    </div>
                  </div>
                  <div className="w-full overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
                    <div
                      role="tablist"
                      aria-label={t("OIDC_BRANDING_FORM.PAGE_TABS_LABEL")}
                      className="flex w-max gap-1 rounded-lg bg-muted/50 p-1"
                    >
                      {pageOptions.map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          role="tab"
                          aria-selected={selectedPage === key}
                          className={cn(
                            "rounded-md px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                            selectedPage === key
                              ? "bg-background text-high-emphasis shadow-xs"
                              : "text-muted-foreground hover:bg-background/60 hover:text-high-emphasis",
                          )}
                          onClick={() => void setEditorState({ page: key })}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-border pb-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-high-emphasis">{selectedPageLabel}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {t("OIDC_BRANDING_FORM.FIELD_COUNT", { count: selectedPageFields.length })}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-medium",
                          isSelectedPageDirty ? "text-warning-700" : "text-muted-foreground",
                        )}
                      >
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            isSelectedPageDirty ? "bg-warning-500" : "bg-success",
                          )}
                          aria-hidden
                        />
                        {isSelectedPageDirty
                          ? t("OIDC_BRANDING_FORM.UNSAVED_CHANGES")
                          : t("OIDC_BRANDING_FORM.SAVED")}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        /**
                         * The page name stays in the accessible name only: spelling it out
                         * on the button made it resize on every page switch ("Save Login" vs
                         * "Save Account Selector"), and it already reads off the heading
                         * immediately to its left. Outline, not solid, so the header's
                         * whole-template Save stays the screen's single primary action and
                         * the two don't read as rival buttons.
                         */
                        aria-label={t("OIDC_BRANDING_FORM.SAVE_PAGE_LABEL", {
                          page: selectedPageLabel,
                        })}
                        aria-busy={isSavingSelectedPage}
                        onClick={() => void handleSavePage(selectedPage)}
                        disabled={
                          !isSelectedPageDirty || !isSelectedPageValid || isSavingSelectedPage
                        }
                        className="gap-1.5 px-3 text-xs font-semibold shadow-none hover:border-primary hover:bg-transparent hover:text-primary"
                      >
                        {isSavingSelectedPage && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        )}
                        {isSavingSelectedPage
                          ? t("OIDC_BRANDING_FORM.SAVING")
                          : t("common:SAVE_CHANGES")}
                      </Button>
                    </div>
                  </div>
                  <div className="grid min-w-0 grid-cols-1 gap-4">
                    {selectedPageFields.map(({ key, label, optional, multiline, placeholder }) => {
                      const error = fieldError(`pages.${selectedPage}.${key}`);
                      const controlProps = {
                        id: `page-${selectedPage}-${key}`,
                        value: selectedPageValues[key] ?? "",
                        maxLength: 200,
                        placeholder,
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
                              {t(KEY_FIELD_ERROR, { label, error })}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="page-shared-footerText" className="text-xs">
                        {t("OIDC_BRANDING_FORM.FOOTER")} <span className="text-destructive">*</span>
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
                                    shared: {
                                      ...current.pages.shared,
                                      footerText: event.target.value,
                                    },
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
                        {t("OIDC_BRANDING_FORM.FOOTER_HINT")}
                      </p>
                      {fieldError("pages.shared.footerText") && (
                        <p className="text-xs text-destructive" role="alert">
                          {t("OIDC_BRANDING_FORM.FOOTER_ERROR", {
                            error: fieldError("pages.shared.footerText"),
                          })}
                        </p>
                      )}
                    </div>
                    {sharedFields.map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <Label htmlFor={`page-shared-${key}`} className="text-xs">
                          {label} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                          id={`page-shared-${key}`}
                          value={draft.pages.shared[key as keyof typeof draft.pages.shared]}
                          maxLength={200}
                          onChange={(event) => {
                            setDraft((current) =>
                              current
                                ? {
                                    ...current,
                                    pages: {
                                      ...current.pages,
                                      shared: {
                                        ...current.pages.shared,
                                        [key]: event.target.value,
                                      },
                                    },
                                  }
                                : current,
                            );
                            clearServerFieldError(`pages.shared.${key}`);
                          }}
                          aria-invalid={!!fieldError(`pages.shared.${key}`)}
                          className="bg-background shadow-none"
                        />
                        {fieldError(`pages.shared.${key}`) && (
                          <p className="text-xs text-destructive" role="alert">
                            {t(KEY_FIELD_ERROR, {
                              label,
                              error: fieldError(`pages.shared.${key}`),
                            })}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </TabsContent>

                <TabsContent value="layout" className="m-0 space-y-6">
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/30 text-muted-foreground">
                      <PanelRight className="h-4 w-4" aria-hidden />
                    </div>
                    <div>
                      <h2 className="text-base font-semibold">
                        {t("OIDC_BRANDING_FORM.LAYOUT_TITLE")}
                      </h2>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        {t("OIDC_BRANDING_FORM.LAYOUT_HINT")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                    <div className="min-w-0 space-y-0.5">
                      <Label htmlFor="oidc-show-animation-panel" className="text-sm">
                        {t("OIDC_BRANDING_FORM.SHOW_ANIMATION_PANEL")}
                      </Label>
                      <p
                        id="oidc-show-animation-panel-hint"
                        className="text-xs text-muted-foreground"
                      >
                        {t("OIDC_BRANDING_FORM.SHOW_ANIMATION_PANEL_HINT")}
                      </p>
                    </div>
                    <Switch
                      id="oidc-show-animation-panel"
                      size="md"
                      checked={draft.layout.showAnimationPanel}
                      onCheckedChange={updateLayout}
                      disabled={isBusy}
                      aria-describedby="oidc-show-animation-panel-hint"
                    />
                  </div>
                </TabsContent>
              </div>
            </ScrollArea>
          </section>

          <section className="flex min-h-0 min-w-0 flex-col bg-muted/20">
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border bg-card/80 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-sm font-semibold text-high-emphasis">
                  {t("OIDC_BRANDING_FORM.LIVE_PREVIEW")}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("OIDC_BRANDING_FORM.PREVIEW_SUBTITLE", { page: selectedPageLabel })}
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
                {isDirty ? t("OIDC_BRANDING_FORM.UNSAVED") : t("OIDC_BRANDING_FORM.SAVED")}
              </div>
            </div>
            <div className="flex min-h-[500px] flex-1 items-center justify-center p-3 sm:min-h-[560px] sm:p-4 lg:min-h-[620px] xl:min-h-0 xl:p-3">
              <div className="h-full max-h-full w-full max-w-2xl overflow-hidden rounded-xl border border-border bg-background shadow-xs">
                <OidcTemplatePreview
                  template={previewTemplate}
                  selectedPage={selectedPage}
                  previewMode={previewMode}
                  onPreviewModeChange={handlePreviewModeChange}
                  showAuto={editorTab !== "theme"}
                  collectPasswordOnActivation={authConfig?.collectPasswordOnActivation}
                />
              </div>
            </div>
          </section>
        </Tabs>
      </CardContent>
    </Card>
  );
};

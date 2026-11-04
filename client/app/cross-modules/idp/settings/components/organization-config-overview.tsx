import { Badge } from "@/components/ui-kits/badge/badge";
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model";
import { cn } from "@/lib/utils";
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout";
import { useT } from "@seliseblocks/genesis-os";
import { Check, X } from "lucide-react";
import type { ReactNode } from "react";

type OrganizationConfigOverviewProps = {
  config: ISettingsOrganizationConfig;
};

type OverviewSectionProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

const OverviewSection = ({ title, description, children }: OverviewSectionProps) => (
  <section className="space-y-3">
    <div className="space-y-0.5">
      <h3 className={SETTINGS_FORM_LAYOUT.overviewSectionTitle}>{title}</h3>
      {description ? <p className={SETTINGS_FORM_LAYOUT.fieldDescription}>{description}</p> : null}
    </div>
    {children}
  </section>
);

type SourceTileProps = {
  label: string;
  enabled: boolean;
};

const SourceTile = ({ label, enabled }: SourceTileProps) => {
  const { t } = useT("os.idp.settings");
  return (
    <div
      className={cn(
        "flex min-h-18 flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-center transition-colors",
        enabled
          ? "border-emerald-200/80 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20"
          : "border-border/80 bg-muted/20",
      )}
    >
      {enabled ? (
        <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400" aria-hidden />
      ) : (
        <X className="h-4 w-4 text-muted-foreground" aria-hidden />
      )}
      <span className={cn(SETTINGS_FORM_LAYOUT.chipTitleBadge, "leading-tight")}>{label}</span>
      <span className="sr-only">{enabled ? t("common:ENABLED") : t("common:DISABLED")}</span>
    </div>
  );
};

export const OrganizationConfigOverview = ({ config }: OrganizationConfigOverviewProps) => {
  const { t } = useT("os.idp.settings");
  const creationSources = [
    {
      key: "cloud",
      label: t("ORGANIZATION_CONFIG_OVERVIEW.SOURCE_CLOUD"),
      enabled: config.allowCreationFromCloud,
    },
    {
      key: "construct",
      label: t("ORGANIZATION_CONFIG_OVERVIEW.SOURCE_CONSTRUCT"),
      enabled: config.allowCreationFromConstruct,
    },
    {
      key: "signup",
      label: t("ORGANIZATION_CONFIG_OVERVIEW.SOURCE_SIGNUP"),
      enabled: config.allowOrgCreationFromSignup,
    },
    {
      key: "portal",
      label: t("ORGANIZATION_CONFIG_OVERVIEW.SOURCE_PORTAL"),
      enabled: config.allowOrgCreationFromPortal,
    },
  ];

  const enabledSourceCount = creationSources.filter((source) => source.enabled).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className={SETTINGS_FORM_LAYOUT.overviewMetaLabel}>
            {t("ORGANIZATION_CONFIG_OVERVIEW.CONFIG_ID")}
          </p>
          <p
            className={cn(SETTINGS_FORM_LAYOUT.fieldValue, "break-all font-mono")}
            title={config.itemId || undefined}
          >
            {config.itemId || "—"}
          </p>
        </div>
        <Badge
          variant={config.isMultiOrgEnabled ? "default" : "secondary"}
          className="w-fit shrink-0 self-start sm:self-center"
        >
          {config.isMultiOrgEnabled
            ? t("ORGANIZATION_CONFIG_OVERVIEW.MULTI_ORG_ENABLED")
            : t("ORGANIZATION_CONFIG_OVERVIEW.SINGLE_ORGANIZATION")}
        </Badge>
      </div>

      {config.isMultiOrgEnabled ? (
        <OverviewSection
          title={t("ORGANIZATION_CONFIG_OVERVIEW.CREATION_SOURCES")}
          description={t("ORGANIZATION_CONFIG_OVERVIEW.SOURCES_ENABLED", {
            enabled: enabledSourceCount,
            total: creationSources.length,
          })}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {creationSources.map((source) => (
              <SourceTile key={source.key} label={source.label} enabled={source.enabled} />
            ))}
          </div>
        </OverviewSection>
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <p className={SETTINGS_FORM_LAYOUT.toggleTitle}>
            {t("ORGANIZATION_CONFIG_OVERVIEW.SINGLE_ORG_MODE")}
          </p>
          <p className={cn(SETTINGS_FORM_LAYOUT.toggleDescription, "mt-1")}>
            {t("ORGANIZATION_CONFIG_OVERVIEW.ENABLE_HINT")}
          </p>
        </div>
      )}
    </div>
  );
};

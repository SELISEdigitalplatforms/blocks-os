import { Badge } from "@/components/ui-kits/badge/badge"
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model"
import { cn } from "@/lib/utils"
import { SETTINGS_FORM_LAYOUT } from "@blocks-idp/settings/constants/settings-form-layout"
import { Check, X } from "lucide-react"
import type { ReactNode } from "react"

type OrganizationConfigOverviewProps = {
  config: ISettingsOrganizationConfig
}

type OverviewSectionProps = {
  title: string
  description?: string
  children: ReactNode
}

const OverviewSection = ({ title, description, children }: OverviewSectionProps) => (
  <section className="space-y-3">
    <div className="space-y-0.5">
      <h3 className={SETTINGS_FORM_LAYOUT.overviewSectionTitle}>{title}</h3>
      {description ? (
        <p className={SETTINGS_FORM_LAYOUT.fieldDescription}>{description}</p>
      ) : null}
    </div>
    {children}
  </section>
)

type SourceTileProps = {
  label: string
  enabled: boolean
}

const SourceTile = ({ label, enabled }: SourceTileProps) => (
  <div
    className={cn(
      "flex min-h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 text-center transition-colors",
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
    <span className="sr-only">{enabled ? "Enabled" : "Disabled"}</span>
  </div>
)

export const OrganizationConfigOverview = ({ config }: OrganizationConfigOverviewProps) => {
  const creationSources = [
    { key: "cloud", label: "Cloud", enabled: config.allowCreationFromCloud },
    { key: "construct", label: "Construct", enabled: config.allowCreationFromConstruct },
    { key: "signup", label: "Signup", enabled: config.allowOrgCreationFromSignup },
    { key: "portal", label: "Portal", enabled: config.allowOrgCreationFromPortal },
  ]

  const enabledSourceCount = creationSources.filter((source) => source.enabled).length

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className={SETTINGS_FORM_LAYOUT.overviewMetaLabel}>Config ID</p>
          <p
            className={cn(
              SETTINGS_FORM_LAYOUT.fieldValue,
              "break-all font-mono",
            )}
            title={config.itemId || undefined}
          >
            {config.itemId || "—"}
          </p>
        </div>
        <Badge
          variant={config.isMultiOrgEnabled ? "default" : "secondary"}
          className="w-fit shrink-0 self-start sm:self-center"
        >
          {config.isMultiOrgEnabled ? "Multi-org enabled" : "Single organization"}
        </Badge>
      </div>

      {config.isMultiOrgEnabled ? (
        <OverviewSection
          title="Organization creation sources"
          description={`${enabledSourceCount} of ${creationSources.length} sources enabled`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {creationSources.map((source) => (
              <SourceTile key={source.key} label={source.label} enabled={source.enabled} />
            ))}
          </div>
        </OverviewSection>
      ) : (
        <div className="rounded-lg border border-dashed px-4 py-8 text-center">
          <p className={SETTINGS_FORM_LAYOUT.toggleTitle}>Single-organization mode</p>
          <p className={cn(SETTINGS_FORM_LAYOUT.toggleDescription, "mt-1")}>
            Enable multi-organization mode to configure creation sources.
          </p>
        </div>
      )}
    </div>
  )
}

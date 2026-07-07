import { Badge } from "@/components/ui-kits/badge/badge"
import type { ISettingsOrganizationConfig } from "@blocks-idp/settings/models/settings.model"
import { cn } from "@/lib/utils"
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
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
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
    <span className="text-xs font-medium leading-tight text-foreground sm:text-sm">{label}</span>
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
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Config ID
          </p>
          <p
            className="break-all font-mono text-sm text-foreground"
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
          <p className="text-sm font-medium text-foreground">Single-organization mode</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enable multi-organization mode to configure creation sources.
          </p>
        </div>
      )}
    </div>
  )
}

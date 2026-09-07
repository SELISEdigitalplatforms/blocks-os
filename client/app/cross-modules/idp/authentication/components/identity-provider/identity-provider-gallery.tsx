import { ArrowRight, Building2, Plus, Route, User } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import {
  SOCIAL_AUTH_PROVIDERS_CONFIG,
  SSO_PROVIDERS,
} from "@blocks-idp/authentication/constants/sso-providers.constant";
import { ProviderEntryItem } from "./identity-provider-entry-item";
import {
  ENTERPRISE_CARD_INFO,
  PROVIDER_CONFIG,
  SOCIAL_CARD_TAGS,
} from "./identity-provider-visual.constant";

/** The federated sign-in explainer, shown only while nothing is configured yet. */
function FederatedFlow() {
  const googleLogo = SOCIAL_AUTH_PROVIDERS_CONFIG[SSO_PROVIDERS.google];
  const microsoftLogo = SOCIAL_AUTH_PROVIDERS_CONFIG[SSO_PROVIDERS.microsoft];

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-high-emphasis">
            How a federated sign-in works
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
          You configure the provider once here — Blocks OS handles the redirect, token exchange and
          role assignment.
        </p>

        <div className="mt-5 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          <div className="flex-1 rounded-lg border bg-muted/40 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <User className="h-4 w-4 text-medium-emphasis" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-high-emphasis">Your user</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Clicks “Continue with Google”
                </p>
              </div>
            </div>
          </div>

          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-border-medium-emphasis lg:rotate-0" />

          <div className="flex-1 rounded-lg border border-primary/25 bg-primary/[0.04] px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-primary">Blocks OS</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Verifies the token, applies roles
                </p>
              </div>
            </div>
          </div>

          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-border-medium-emphasis lg:rotate-0" />

          <div className="flex-1 rounded-lg border bg-muted/40 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex shrink-0 gap-1.5">
                {[googleLogo, microsoftLogo].map(
                  (config) =>
                    config && (
                      <img
                        key={config.provider}
                        src={config.imageSrc}
                        alt={config.label}
                        className="h-6 w-6 object-contain"
                      />
                    ),
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-high-emphasis">Identity provider</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Authenticates the account</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-high-emphasis">
        {title}
      </h2>
      <span className="text-[13px] text-muted-foreground">{hint}</span>
    </div>
  );
}

function StatusPill({ isConfigured }: { isConfigured: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        isConfigured
          ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-muted text-medium-emphasis",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          isConfigured ? "bg-emerald-500" : "bg-low-emphasis",
        )}
      />
      {isConfigured ? "Connected" : "Not configured"}
    </span>
  );
}

interface SocialProviderCardProps {
  provider: "google" | "microsoft";
  entry?: IdentityProvider;
  onSelect: () => void;
}

function SocialProviderCard({ provider, entry, onSelect }: SocialProviderCardProps) {
  const config = SOCIAL_AUTH_PROVIDERS_CONFIG[provider as SSO_PROVIDERS];
  if (!config) return null;
  const isConfigured = !!entry;
  const cta = isConfigured ? "Manage" : `Configure ${config.label}`;

  return (
    <button
      type="button"
      aria-label={cta}
      onClick={onSelect}
      className="group w-full cursor-pointer rounded-sm border bg-card p-5 text-left shadow-sm transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <div className="flex items-start gap-3.5">
        <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border bg-background">
          <img src={config.imageSrc} alt={config.label} className="h-7 w-7 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-high-emphasis">{config.label}</p>
            <StatusPill isConfigured={isConfigured} />
          </div>
          <p className="mt-1.5 text-[13px] leading-relaxed text-muted-foreground">
            {config.description}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3.5">
        <div className="flex flex-wrap gap-1.5">
          {SOCIAL_CARD_TAGS[provider].map((tag) => (
            <span
              key={tag}
              className="rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium text-medium-emphasis"
            >
              {tag}
            </span>
          ))}
        </div>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-primary">
          {cta}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </button>
  );
}

interface EnterpriseProviderCardProps {
  providerType: "blocks-oidc" | "byos";
  entries: IdentityProvider[];
  onAdd: () => void;
}

function EnterpriseProviderCard({ providerType, entries, onAdd }: EnterpriseProviderCardProps) {
  const cfg = PROVIDER_CONFIG[providerType];
  const { label, description } = ENTERPRISE_CARD_INFO[providerType];
  const Icon = cfg.Icon;

  return (
    <Card className="flex flex-col p-0">
      <CardContent className="flex flex-1 flex-col gap-3.5 p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px]",
              cfg.iconBg,
            )}
          >
            <Icon className={cn("h-[18px] w-[18px]", cfg.iconColor)} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[14.5px] font-semibold text-high-emphasis">{label}</p>
              {entries.length > 0 && (
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-medium-emphasis">
                  {entries.length} configured
                </span>
              )}
            </div>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
        </div>

        {entries.length > 0 && (
          <ul aria-label={`Configured ${label} providers`} className="space-y-2">
            {entries.map((entry) => (
              <ProviderEntryItem key={entry.itemId} item={entry} />
            ))}
          </ul>
        )}

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-auto h-8 gap-1.5 self-start px-3 text-xs font-semibold hover:border-primary hover:bg-transparent hover:text-primary"
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          Add {label}
        </Button>
      </CardContent>
    </Card>
  );
}

export const GallerySkeleton = () => (
  <div className="space-y-6">
    {["social", "enterprise"].map((section) => (
      <div key={section} className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-3.5">
                <Skeleton className="h-[52px] w-[52px] shrink-0 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="mt-4 h-7 w-32" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    ))}
  </div>
);

export interface IdentityProviderGalleryProps {
  showHowItWorks: boolean;
  googleEntry?: IdentityProvider;
  microsoftEntry?: IdentityProvider;
  blocksOidcEntries: IdentityProvider[];
  byosEntries: IdentityProvider[];
  onSelectGoogle: () => void;
  onSelectMicrosoft: () => void;
  onSelectBlocksOidc: () => void;
  onSelectByos: () => void;
}

export function IdentityProviderGallery({
  showHowItWorks,
  googleEntry,
  microsoftEntry,
  blocksOidcEntries,
  byosEntries,
  onSelectGoogle,
  onSelectMicrosoft,
  onSelectBlocksOidc,
  onSelectByos,
}: IdentityProviderGalleryProps) {
  return (
    <div className="space-y-6">
      {showHowItWorks && <FederatedFlow />}

      <section className="space-y-3">
        <SectionHeading
          title="Social logins"
          hint="Pick a provider to configure it — no forms to hunt through."
        />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SocialProviderCard provider="google" entry={googleEntry} onSelect={onSelectGoogle} />
          <SocialProviderCard
            provider="microsoft"
            entry={microsoftEntry}
            onSelect={onSelectMicrosoft}
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          title="Enterprise & custom"
          hint="For providers that aren't a public social login."
        />
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <EnterpriseProviderCard
            providerType="blocks-oidc"
            entries={blocksOidcEntries}
            onAdd={onSelectBlocksOidc}
          />
          <EnterpriseProviderCard providerType="byos" entries={byosEntries} onAdd={onSelectByos} />
        </div>
      </section>
    </div>
  );
}

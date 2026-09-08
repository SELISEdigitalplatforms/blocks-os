import { useId, useState } from "react";
import { ArrowRight, Building2, ChevronRight, Plus, Route, User } from "lucide-react";
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

function NotConfiguredPill() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-medium-emphasis">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-low-emphasis" />
      Not configured
    </span>
  );
}

/**
 * The add action for a card's provider type, sitting opposite the card title — every
 * type (Google and Microsoft included) can hold more than one entry, so it stays
 * available no matter how many are already configured.
 */
function AddProviderButton({ label, onAdd }: { label: string; onAdd: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Add ${label}`}
      title={`Add ${label}`}
      className="h-7 w-7 shrink-0 p-0 hover:border-primary hover:bg-transparent hover:text-primary"
      onClick={onAdd}
    >
      <Plus className="h-3.5 w-3.5" />
    </Button>
  );
}

/**
 * The card's status pill - sits in a footer strip at the bottom of the card, in the
 * same spot whether the type is unconfigured or already has entries. With entries, it
 * doubles as the collapse toggle for the list rendered above it (see
 * `ProviderEntriesList`), so "Not configured" and "N configured" never jump between two
 * different positions on a card.
 */
function ConfigurationStatus({
  count,
  expanded,
  onToggle,
  listId,
}: {
  count: number;
  expanded: boolean;
  onToggle: () => void;
  listId: string;
}) {
  if (count === 0) return <NotConfiguredPill />;

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={listId}
      onClick={onToggle}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-medium-emphasis transition-colors hover:text-high-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <ChevronRight
        className={cn(
          "h-3 w-3 shrink-0 transition-transform duration-200",
          expanded && "rotate-90",
        )}
      />
      {count} configured
    </button>
  );
}

/** The configured entries of one provider type, listed inline on its card - folded away
 * when `expanded` is false (toggled from the `ConfigurationStatus` pill in the header). */
function ProviderEntriesList({
  label,
  entries,
  expanded,
  listId,
}: {
  label: string;
  entries: IdentityProvider[];
  expanded: boolean;
  listId: string;
}) {
  if (entries.length === 0 || !expanded) return null;

  return (
    <ul id={listId} aria-label={`Configured ${label} providers`} className="space-y-2">
      {entries.map((entry) => (
        <ProviderEntryItem key={entry.itemId} item={entry} />
      ))}
    </ul>
  );
}

interface SocialProviderCardProps {
  provider: "google" | "microsoft";
  entries: IdentityProvider[];
  onAdd: () => void;
}

function SocialProviderCard({ provider, entries, onAdd }: SocialProviderCardProps) {
  const config = SOCIAL_AUTH_PROVIDERS_CONFIG[provider as SSO_PROVIDERS];
  const [expanded, setExpanded] = useState(true);
  const listId = useId();
  if (!config) return null;

  return (
    <Card className="p-0">
      <CardContent className="flex flex-col gap-3.5 p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border bg-background">
            <img src={config.imageSrc} alt={config.label} className="h-5 w-5 object-contain" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-high-emphasis">{config.label}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
              {config.description}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SOCIAL_CARD_TAGS[provider].map((tag) => (
                <span
                  key={tag}
                  className="rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium text-medium-emphasis"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <AddProviderButton label={config.label} onAdd={onAdd} />
        </div>

        <ProviderEntriesList
          label={config.label}
          entries={entries}
          expanded={expanded}
          listId={listId}
        />

        <div className="border-t pt-3">
          <ConfigurationStatus
            count={entries.length}
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
            listId={listId}
          />
        </div>
      </CardContent>
    </Card>
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
  const [expanded, setExpanded] = useState(true);
  const listId = useId();

  return (
    <Card className="p-0">
      <CardContent className="flex flex-col gap-3.5 p-4 sm:p-5">
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
            <p className="text-[14.5px] font-semibold text-high-emphasis">{label}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <AddProviderButton label={label} onAdd={onAdd} />
        </div>

        <ProviderEntriesList label={label} entries={entries} expanded={expanded} listId={listId} />

        <div className="border-t pt-3">
          <ConfigurationStatus
            count={entries.length}
            expanded={expanded}
            onToggle={() => setExpanded((e) => !e)}
            listId={listId}
          />
        </div>
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
  googleEntries: IdentityProvider[];
  microsoftEntries: IdentityProvider[];
  blocksOidcEntries: IdentityProvider[];
  byosEntries: IdentityProvider[];
  onSelectGoogle: () => void;
  onSelectMicrosoft: () => void;
  onSelectBlocksOidc: () => void;
  onSelectByos: () => void;
}

export function IdentityProviderGallery({
  googleEntries,
  microsoftEntries,
  blocksOidcEntries,
  byosEntries,
  onSelectGoogle,
  onSelectMicrosoft,
  onSelectBlocksOidc,
  onSelectByos,
}: IdentityProviderGalleryProps) {
  return (
    <div className="space-y-6">
      <FederatedFlow />

      <section className="space-y-3">
        <SectionHeading
          title="Social logins"
          hint="Pick a provider to configure it — no forms to hunt through."
        />
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
          <SocialProviderCard provider="google" entries={googleEntries} onAdd={onSelectGoogle} />
          <SocialProviderCard
            provider="microsoft"
            entries={microsoftEntries}
            onAdd={onSelectMicrosoft}
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

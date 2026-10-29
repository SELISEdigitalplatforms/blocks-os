import { useId, useState } from "react";
import { ArrowRight, Building2, ChevronRight, Code2, KeyRound, Plus, Route } from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { cn } from "@/lib/utils";
import type { ThirdPartyJwtProvider } from "@/cross-modules/identifier/models/third-party-jwt-provider.model";
import { ExternalIdpEntryItem, type ExternalIdpEntryActions } from "./external-idp-entry-item";
import {
  EXTERNAL_IDP_CARD_INFO,
  externalIdpCardId,
  externalIdpLogo,
  PLATFORM_CARD_IDS,
  type ExternalIdpCardId,
} from "./external-idp-visual.constant";

function ProviderLogo({ id, className }: Readonly<{ id: ExternalIdpCardId; className?: string }>) {
  const src = externalIdpLogo(id);
  const { label, darkInvert } = EXTERNAL_IDP_CARD_INFO[id];
  if (!src) return null;

  return (
    <img
      src={src}
      alt={label}
      className={cn("object-contain", darkInvert && "dark:invert", className)}
    />
  );
}

/**
 * How an externally issued token reaches the APIs, with the tenant-wide trust switch underneath:
 * the switch is the one thing that decides whether any of the flow above it happens.
 */
function TrustFlow({ trustToggle }: Readonly<{ trustToggle: React.ReactNode }>) {
  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold text-high-emphasis">
            How external token trust works
          </h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground sm:text-[13px]">
          Your users keep signing in where they already do — Blocks OS verifies the tokens that
          provider issues and maps them onto a Blocks user.
        </p>

        <div className="mt-5 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
          <div className="flex-1 rounded-lg border bg-muted/40 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex shrink-0 -space-x-1.5">
                {PLATFORM_CARD_IDS.map((id) => (
                  <div
                    key={id}
                    className="flex h-7 w-7 items-center justify-center rounded-full border bg-background"
                  >
                    <ProviderLogo id={id} className="h-3.5 w-3.5" />
                  </div>
                ))}
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-high-emphasis">Identity provider</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Signs in, issues a JWT</p>
              </div>
            </div>
          </div>

          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-border-medium-emphasis lg:rotate-0" />

          <div className="flex-1 rounded-lg border bg-muted/40 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Code2 className="h-4 w-4 text-medium-emphasis" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-high-emphasis">Your app</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Sends it as a bearer token</p>
              </div>
            </div>
          </div>

          <ArrowRight className="mx-auto h-4 w-4 shrink-0 rotate-90 text-border-medium-emphasis lg:rotate-0" />

          <div className="flex-1 rounded-lg border border-primary/25 bg-primary/4 px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold text-primary">Blocks OS</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Verifies the signature, maps claims
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t pt-4">{trustToggle}</div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ title, hint }: Readonly<{ title: string; hint: string }>) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
      <h2 className="text-[13px] font-bold uppercase tracking-[0.06em] text-high-emphasis">
        {title}
      </h2>
      <span className="text-[13px] text-muted-foreground">{hint}</span>
    </div>
  );
}

/**
 * The card's status pill, in a footer strip that stays put whether the platform has entries or
 * not. With entries, it doubles as the collapse toggle for the list above it.
 */
function ConfigurationStatus({
  count,
  expanded,
  onToggle,
  listId,
}: Readonly<{
  count: number;
  expanded: boolean;
  onToggle: () => void;
  listId: string;
}>) {
  if (count === 0) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-medium-emphasis">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-low-emphasis" />
        Not configured
      </span>
    );
  }

  return (
    <button
      type="button"
      aria-expanded={expanded}
      aria-controls={listId}
      onClick={onToggle}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-medium-emphasis transition-colors hover:text-high-emphasis focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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

type ProviderCardProps = ExternalIdpEntryActions & {
  id: ExternalIdpCardId;
  entries: ThirdPartyJwtProvider[];
  onAdd: (providerName: string) => void;
};

function ExternalIdpCard({ id, entries, onAdd, ...actions }: Readonly<ProviderCardProps>) {
  const { label, description, tags, providerName } = EXTERNAL_IDP_CARD_INFO[id];
  const [expanded, setExpanded] = useState(true);
  const listId = useId();
  const isCustom = id === "others";

  return (
    <Card className="p-0">
      <CardContent className="flex flex-col gap-3.5 p-4 sm:p-5">
        <div className="flex items-start gap-3.5">
          {isCustom ? (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-purple-100 dark:bg-purple-950">
              <KeyRound className="h-[18px] w-[18px] text-purple-600 dark:text-purple-400" />
            </div>
          ) : (
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] border bg-background">
              <ProviderLogo id={id} className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-high-emphasis">{label}</p>
            <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{description}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-sm bg-muted px-2 py-0.5 text-[11px] font-medium text-medium-emphasis"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={`Add ${label}`}
            title={`Add ${label}`}
            className="h-7 w-7 shrink-0 p-0 hover:border-primary hover:bg-transparent hover:text-primary"
            onClick={() => onAdd(providerName)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>

        {entries.length > 0 && expanded && (
          <ul id={listId} aria-label={`Configured ${label} providers`} className="space-y-2">
            {entries.map((entry) => (
              <ExternalIdpEntryItem key={entry.itemId} provider={entry} {...actions} />
            ))}
          </ul>
        )}

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

export const ExternalIdpGallerySkeleton = () => (
  <div className="space-y-6">
    {["platforms", "custom"].map((section) => (
      <div key={section} className="space-y-3">
        <Skeleton className="h-4 w-40" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardContent className="flex items-start gap-3.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-[10px]" />
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

type ExternalIdpGalleryProps = ExternalIdpEntryActions & {
  providers: ThirdPartyJwtProvider[];
  isLoading: boolean;
  trustToggle: React.ReactNode;
  /** Sits between the explainer and the cards, e.g. the shared-issuer warning. */
  notice?: React.ReactNode;
  onAdd: (providerName: string) => void;
};

export function ExternalIdpGallery({
  providers,
  isLoading,
  trustToggle,
  notice,
  onAdd,
  ...actions
}: Readonly<ExternalIdpGalleryProps>) {
  const entriesFor = (id: ExternalIdpCardId) =>
    providers.filter((p) => externalIdpCardId(p.providerName) === id);

  return (
    <div className="space-y-6">
      <TrustFlow trustToggle={trustToggle} />

      {notice}

      {isLoading ? (
        <ExternalIdpGallerySkeleton />
      ) : (
        <>
          <section className="space-y-3">
            <SectionHeading
              title="Identity platforms"
              hint="Pick the platform that issues your tokens."
            />
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              {PLATFORM_CARD_IDS.map((id) => (
                <ExternalIdpCard
                  key={id}
                  id={id}
                  entries={entriesFor(id)}
                  onAdd={onAdd}
                  {...actions}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeading title="Custom" hint="For issuers that aren't listed above." />
            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
              <ExternalIdpCard
                id="others"
                entries={entriesFor("others")}
                onAdd={onAdd}
                {...actions}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
}

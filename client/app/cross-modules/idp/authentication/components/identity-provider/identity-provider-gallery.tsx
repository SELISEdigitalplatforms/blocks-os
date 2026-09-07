import { ListChecks, MousePointerClick, Save } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { cn } from "@/lib/utils";
import { IdentityProvider } from "@blocks-idp/authentication/models/identity-provider.model";
import {
  SOCIAL_AUTH_PROVIDERS_CONFIG,
  SSO_PROVIDERS,
} from "@blocks-idp/authentication/constants/sso-providers.constant";
import { PROVIDER_CONFIG } from "./identity-provider-visual.constant";

const HOW_IT_WORKS_STEPS = [
  {
    Icon: ListChecks,
    title: "Pick a sign-in option",
    description: "Choose a social login or an enterprise/custom provider from the gallery below.",
  },
  {
    Icon: MousePointerClick,
    title: "Fill in its details",
    description: "The dialog opens pre-set to that provider - add its client ID and secret.",
  },
  {
    Icon: Save,
    title: "Save and go live",
    description: "Once saved, it shows up here as connected and users can sign in with it.",
  },
];

function HowItWorks() {
  return (
    <Card>
      <CardContent className="p-4 sm:p-5">
        <p className="text-sm font-semibold text-high-emphasis">How it works</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map(({ Icon, title, description }, index) => (
            <div key={title} className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted-foreground">Step {index + 1}</p>
                <p className="text-sm font-medium text-high-emphasis">{title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-sm font-semibold text-high-emphasis">{title}</h2>;
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

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          <img src={config.imageSrc} alt={config.label} className="h-5 w-5 object-contain" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium text-high-emphasis">{config.label}</p>
            <Badge
              variant="outline"
              className={cn(
                "w-fit shrink-0 gap-1.5 border-transparent px-2 py-0.5 text-xs font-medium",
                isConfigured
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                  : "bg-muted/60 text-muted-foreground",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  isConfigured ? "bg-emerald-500" : "bg-muted-foreground/40",
                )}
              />
              {isConfigured ? "Connected" : "Not configured"}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{config.description}</p>
          <Button
            type="button"
            variant={isConfigured ? "outline" : "default"}
            size="sm"
            className="mt-3 h-7 px-2.5 text-xs"
            onClick={onSelect}
          >
            {isConfigured ? "Manage" : `Configure ${config.label}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface EnterpriseProviderCardProps {
  providerType: "blocks-oidc" | "byos";
  label: string;
  description: string;
  onSelect: () => void;
}

function EnterpriseProviderCard({
  providerType,
  label,
  description,
  onSelect,
}: EnterpriseProviderCardProps) {
  const cfg = PROVIDER_CONFIG[providerType];
  const Icon = cfg.Icon;

  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", cfg.iconBg)}>
          <Icon className={cn("h-5 w-5", cfg.iconColor)} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-high-emphasis">{label}</p>
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-3 h-7 px-2.5 text-xs"
            onClick={onSelect}
          >
            Configure
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export interface IdentityProviderGalleryProps {
  showHowItWorks: boolean;
  googleEntry?: IdentityProvider;
  microsoftEntry?: IdentityProvider;
  onSelectGoogle: () => void;
  onSelectMicrosoft: () => void;
  onSelectBlocksOidc: () => void;
  onSelectByos: () => void;
}

export function IdentityProviderGallery({
  showHowItWorks,
  googleEntry,
  microsoftEntry,
  onSelectGoogle,
  onSelectMicrosoft,
  onSelectBlocksOidc,
  onSelectByos,
}: IdentityProviderGalleryProps) {
  const byosDescription =
    SOCIAL_AUTH_PROVIDERS_CONFIG[SSO_PROVIDERS.ownsso]?.description ?? "Bring your own SSO provider";

  return (
    <div className="space-y-6">
      {showHowItWorks && <HowItWorks />}

      <div className="space-y-3">
        <SectionHeading title="Social logins" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SocialProviderCard provider="google" entry={googleEntry} onSelect={onSelectGoogle} />
          <SocialProviderCard
            provider="microsoft"
            entry={microsoftEntry}
            onSelect={onSelectMicrosoft}
          />
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeading title="Enterprise & custom" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <EnterpriseProviderCard
            providerType="blocks-oidc"
            label="Blocks OIDC"
            description="Use your project's built-in Blocks OIDC provider for first-party sign-in."
            onSelect={onSelectBlocksOidc}
          />
          <EnterpriseProviderCard
            providerType="byos"
            label="Bring your own SSO"
            description={byosDescription}
            onSelect={onSelectByos}
          />
        </div>
      </div>
    </div>
  );
}

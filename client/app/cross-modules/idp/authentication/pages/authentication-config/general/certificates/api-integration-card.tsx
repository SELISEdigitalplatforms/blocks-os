import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { useT } from "@seliseblocks/genesis-os";
import { USER_ENDPOINTS } from "@blocks-idp/iam/constants/endpoint.constant";
import {
  requiresIdpHeader,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const IDP_HEADER = "x-blocks-idp";
const KEY_HEADER = "x-blocks-key";

type CopyButtonProps = { label: string; value: string; className?: string };

function CopyButton({ label, value, className }: Readonly<CopyButtonProps>) {
  const { t } = useT("os.idp.auth");
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused; the value is on screen either way.
      setCopied(false);
    }
  };

  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      className={cn("h-7 w-7 shrink-0", className)}
      aria-label={
        copied ? t("API_INTEGRATION_CARD.LABEL_COPIED", { label }) : t("API_INTEGRATION_CARD.COPY_LABEL", { label })
      }
      onClick={copy}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

type CopyableProps = { label: string; value: string; copyable?: boolean };

function Copyable({ label, value, copyable = true }: Readonly<CopyableProps>) {
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-sm">
        {value}
      </code>
      {copyable && <CopyButton label={label} value={value} />}
    </div>
  );
}

type HeaderRowProps = {
  name: string;
  value: string;
  note: string;
  copyable?: boolean;
};

function HeaderRow({ name, value, note, copyable }: Readonly<HeaderRowProps>) {
  return (
    <div className="grid grid-cols-1 gap-2 border-b py-3 last:border-b-0 sm:grid-cols-[minmax(0,14rem)_1fr] sm:gap-4">
      <div className="space-y-1">
        <code className="font-mono text-sm font-medium">{name}</code>
        <p className="text-xs text-muted-foreground">{note}</p>
      </div>
      <Copyable label={name} value={value} copyable={copyable} />
    </div>
  );
}

type ApiIntegrationCardProps = {
  provider: ThirdPartyJwtProvider;
  allProviders: ThirdPartyJwtProvider[];
  projectKey: string;
};

/**
 * Tells the caller how to reach this provider from their own API requests.
 *
 * The header is presented as conditional rather than mandatory: issuer and audience identify a
 * provider on their own almost always, and telling everyone to send a header they do not need is
 * how headers end up copied around and then wrong. Sending it regardless is always accepted.
 */
export function ApiIntegrationCard({
  provider,
  allProviders,
  projectKey,
}: Readonly<ApiIntegrationCardProps>) {
  const { t } = useT("os.idp.auth");
  const headerRequired = requiresIdpHeader(provider, allProviders);
  const bearer = `Bearer <token from ${provider.providerName || "your provider"}>`;

  // Every header is in the sample, x-blocks-idp included: it is accepted whether or not it is
  // required, so a request copied once keeps working if another provider is added later.
  const curl = [
    `curl ${USER_ENDPOINTS.ME} \\`,
    `  -H 'Authorization: ${bearer}' \\`,
    `  -H '${KEY_HEADER}: ${projectKey || "<your project key>"}' \\`,
    `  -H '${IDP_HEADER}: ${provider.key}'`,
  ].join("\n");

  return (
    <Card>
      <CardContent className="space-y-5 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{t("API_INTEGRATION_CARD.TITLE")}</h3>
            <p className="text-xs text-muted-foreground">
              {t("API_INTEGRATION_CARD.INTRO")}
            </p>
          </div>
          <Badge variant={headerRequired ? "default" : "secondary"}>
            {headerRequired ? t("API_INTEGRATION_CARD.HEADER_REQUIRED") : t("API_INTEGRATION_CARD.HEADER_OPTIONAL")}
          </Badge>
        </div>

        <div className="rounded-md border px-4">
          <HeaderRow
            name="Authorization"
            value={bearer}
            note={t("API_INTEGRATION_CARD.AUTHORIZATION_NOTE")}
            copyable={false}
          />
          <HeaderRow
            name={KEY_HEADER}
            value={projectKey || "<your project key>"}
            note={t("API_INTEGRATION_CARD.KEY_NOTE")}
          />
          <HeaderRow
            name={IDP_HEADER}
            value={provider.key}
            note={
              headerRequired
                ? t("API_INTEGRATION_CARD.IDP_NOTE_REQUIRED")
                : t("API_INTEGRATION_CARD.IDP_NOTE_OPTIONAL")
            }
          />
        </div>

        {headerRequired ? (
          <p className="text-xs text-muted-foreground">
            {t("API_INTEGRATION_CARD.REQUIRED_EXPLANATION", { header: IDP_HEADER })}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("API_INTEGRATION_CARD.OPTIONAL_EXPLANATION", { header: IDP_HEADER })}
          </p>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("API_INTEGRATION_CARD.EXAMPLE_TITLE")}
            </p>
            <CopyButton label={t("API_INTEGRATION_CARD.EXAMPLE_REQUEST")} value={curl} className="-mr-1" />
          </div>
          <pre className="overflow-x-auto rounded bg-muted p-3 font-mono text-xs leading-relaxed">
            {curl}
          </pre>
          <p className="text-xs text-muted-foreground">
            {t("API_INTEGRATION_CARD.EXAMPLE_RESULT")}{" "}
            {headerRequired
              ? t("API_INTEGRATION_CARD.EXAMPLE_HEADER_REQUIRED", { header: IDP_HEADER })
              : t("API_INTEGRATION_CARD.EXAMPLE_HEADER_OPTIONAL", { header: IDP_HEADER })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

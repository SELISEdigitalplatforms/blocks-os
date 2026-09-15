import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  requiresIdpHeader,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const IDP_HEADER = "x-blocks-idp";

type CopyableProps = { label: string; value: string };

function Copyable({ label, value }: Readonly<CopyableProps>) {
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
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-sm">
          {value}
        </code>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 shrink-0"
          aria-label={copied ? `${label} copied` : `Copy ${label}`}
          onClick={copy}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
    </div>
  );
}

type ApiIntegrationCardProps = {
  provider: ThirdPartyJwtProvider;
  allProviders: ThirdPartyJwtProvider[];
};

/**
 * Tells the caller how to reach this provider from their own API requests.
 *
 * The header is deliberately presented as conditional rather than mandatory: issuer and audience
 * identify a provider on their own almost always, and telling everyone to send a header they do
 * not need is how headers end up copied around and then wrong.
 */
export function ApiIntegrationCard({
  provider,
  allProviders,
}: Readonly<ApiIntegrationCardProps>) {
  const headerRequired = requiresIdpHeader(provider, allProviders);

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">Calling the API with this provider&apos;s token</h3>
            <p className="text-xs text-muted-foreground">
              Send the token as <code className="font-mono">Authorization: Bearer …</code> alongside
              your project key.
            </p>
          </div>
          <Badge variant={headerRequired ? "default" : "secondary"}>
            {headerRequired ? "Header required" : "Header optional"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Copyable label="Header name" value={IDP_HEADER} />
          <Copyable label="Header value" value={provider.key} />
        </div>

        {headerRequired ? (
          <p className="text-xs text-muted-foreground">
            Another active provider shares this issuer and audience, so a token alone cannot say
            which of them it belongs to. Requests that omit{" "}
            <code className="font-mono">{IDP_HEADER}</code> will be rejected. Giving the two
            providers different audiences removes the need for it.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            The issuer and audience in the token already identify this provider, so{" "}
            <code className="font-mono">{IDP_HEADER}</code> is not read and callers need not send
            it. It becomes necessary only if you add another provider sharing both.
          </p>
        )}

        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Example
          </p>
          <pre className="overflow-x-auto rounded bg-muted p-3 font-mono text-xs leading-relaxed">
{`curl https://<your-api>/… \\
  -H 'Authorization: Bearer <token from ${provider.providerName || "your provider"}>' \\
  -H 'x-blocks-key: <your project key>'${headerRequired ? ` \\\n  -H '${IDP_HEADER}: ${provider.key}'` : ""}`}
          </pre>
        </div>
      </CardContent>
    </Card>
  );
}

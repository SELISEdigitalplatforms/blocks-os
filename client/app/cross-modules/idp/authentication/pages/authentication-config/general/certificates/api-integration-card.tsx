import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { USER_ENDPOINTS } from "@blocks-idp/iam/constants/endpoint.constant";
import {
  requiresIdpHeader,
  type ThirdPartyJwtProvider,
} from "@/cross-modules/identifier/models/third-party-jwt-provider.model";

const IDP_HEADER = "x-blocks-idp";
const KEY_HEADER = "x-blocks-key";

type CopyButtonProps = { label: string; value: string; className?: string };

function CopyButton({ label, value, className }: Readonly<CopyButtonProps>) {
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
      aria-label={copied ? `${label} copied` : `Copy ${label}`}
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
            <h3 className="text-sm font-semibold">Calling the API with this provider&apos;s token</h3>
            <p className="text-xs text-muted-foreground">
              Every request carries the token and your project key. These are the headers.
            </p>
          </div>
          <Badge variant={headerRequired ? "default" : "secondary"}>
            {headerRequired ? "Header required" : "Header optional"}
          </Badge>
        </div>

        <div className="rounded-md border px-4">
          <HeaderRow
            name="Authorization"
            value={bearer}
            note="The token your provider issued, as a bearer credential."
            copyable={false}
          />
          <HeaderRow
            name={KEY_HEADER}
            value={projectKey || "<your project key>"}
            note="Identifies the project the request belongs to. Always required."
          />
          <HeaderRow
            name={IDP_HEADER}
            value={provider.key}
            note={
              headerRequired
                ? "Required here: another active provider cannot be told apart from this one."
                : "Optional here, and always accepted."
            }
          />
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
            it. It becomes necessary once another provider shares both — and because audience
            validation is off for any provider left without audiences, several such providers on one
            issuer are indistinguishable, which is the same case. Sending the header anyway is
            always accepted, and is the safer default if you expect to add more providers later.
          </p>
        )}

        <div className="space-y-1">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Example — fetch the signed-in user
            </p>
            <CopyButton label="example request" value={curl} className="-mr-1" />
          </div>
          <pre className="overflow-x-auto rounded bg-muted p-3 font-mono text-xs leading-relaxed">
            {curl}
          </pre>
          <p className="text-xs text-muted-foreground">
            A successful call returns the Blocks user the token mapped onto, through the claim
            mapping above.{" "}
            {headerRequired
              ? `${IDP_HEADER} is required here, since another provider shares this issuer and audience.`
              : `${IDP_HEADER} is not needed here, but it is accepted, so the request works as it stands.`}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

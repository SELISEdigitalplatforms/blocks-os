import { Braces, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { Banner } from "@/components/ui-kits/banner/banner";
import { Button } from "@/components/ui-kits/button/button";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button/copy-to-clipboard-button";
import { MaskedText } from "@/components/masked-text/masked-text";
import { showErrorToast, showSuccessToast } from "@/hooks/use-toast";
import { IConnectDetails } from "@/cross-modules/connect/models/connect.model";
import { toConnectJson } from "@/cross-modules/connect/utils/connect-details";

type DetailRowProps = {
  label: string;
  value: string;
  secret?: boolean;
};

function DetailRow({ label, value, secret = false }: Readonly<DetailRowProps>) {
  const [revealed, setRevealed] = useState(false);
  const hidden = secret && !revealed;

  return (
    <div className="grid grid-cols-1 gap-1 border-b border-border py-3 last:border-b-0 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex min-w-0 items-center gap-2">
        <code className="min-w-0 flex-1 truncate font-mono text-sm">
          {!value ? (
            <span className="text-medium-emphasis">Not available</span>
          ) : hidden ? (
            <MaskedText text={value} showFirstN={5} length={24} />
          ) : (
            value
          )}
        </code>
        {secret && value && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={revealed ? `Hide ${label}` : `Show ${label}`}
            onClick={() => setRevealed((r) => !r)}
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        {value && (
          <CopyToClipboardButton textToCopy={value} label={`Copy ${label}`}>
            {null}
          </CopyToClipboardButton>
        )}
      </div>
    </div>
  );
}

const copyJson = async (details: IConnectDetails) => {
  try {
    await navigator.clipboard.writeText(toConnectJson(details));
    showSuccessToast({ description: "Connect details copied as JSON." });
  } catch {
    showErrorToast({ errors: "Could not copy to the clipboard." });
  }
};

type ConnectDetailsCardProps = {
  title: string;
  details: IConnectDetails;
  /** Shown above the values when something is missing, e.g. the credential is gone. */
  warning?: string;
};

export function ConnectDetailsCard({ title, details, warning }: Readonly<ConnectDetailsCardProps>) {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-medium-emphasis">
            Use these values to connect your app. Keep the client secret private.
          </p>
        </div>
        {/* JSON without the secret is not usable config, so it is not offered as if it were. */}
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => copyJson(details)}
          disabled={!details.clientSecret}
        >
          <Braces className="h-4 w-4" />
          <span className="ml-2">Copy as JSON</span>
        </Button>
      </div>
      {warning && (
        <Banner variant="warning" className="mb-4">
          {warning}
        </Banner>
      )}
      <div className="rounded-md border border-border px-4">
        <DetailRow label="Client ID" value={details.clientId} />
        <DetailRow label="Client Secret" value={details.clientSecret} secret />
        <DetailRow label="x-blocks-key" value={details.xBlocksKey} />
        <DetailRow label="Base URL" value={details.baseUrl} />
        <DetailRow label="Domain" value={details.domain} />
      </div>
    </div>
  );
}

import { AlertTriangle, Info } from "lucide-react";
import type { IDnsRecordInstruction, IDomainSetupGuideItem } from "@/models/domain-setup.model";
import { CopyValueButton } from "./copy-value-button";

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[11px] font-semibold uppercase tracking-wide text-medium-emphasis">
    {children}
  </span>
);

const RecordValue = ({ value, copyLabel }: { value: string; copyLabel?: string }) => (
  <div className="flex h-9 min-w-0 items-center gap-1 rounded-md border border-border bg-muted/40 pl-2.5 pr-0.5">
    <code
      className="min-w-0 flex-1 truncate font-mono text-[13px] text-high-emphasis"
      title={value}
    >
      {value}
    </code>
    {copyLabel && <CopyValueButton value={value} label={copyLabel} />}
  </div>
);

const valueHint = (record: IDnsRecordInstruction, cnameTarget?: string) => {
  if (record.type === "A") {
    return cnameTarget
      ? `IP address of ${cnameTarget}. If your provider supports ALIAS / ANAME, you can use that host instead.`
      : undefined;
  }
  if (record.type === "ALIAS") {
    return "Your provider must support ALIAS / ANAME records (sometimes called CNAME flattening).";
  }
  return undefined;
};

interface DnsRecordCardProps {
  index: number;
  record: IDnsRecordInstruction;
  isApex: boolean;
  cnameTarget?: string;
}

const DnsRecordCard = ({ index, record, isApex, cnameTarget }: DnsRecordCardProps) => {
  const purpose =
    record.purpose === "api"
      ? "Blocks API for your app"
      : isApex
        ? "Your app (root domain)"
        : "Your app";
  const hint = valueHint(record, cnameTarget);

  return (
    <section
      aria-label={`Record ${index + 1}`}
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <p className="text-sm">
        <span className="font-semibold text-high-emphasis">Record {index + 1}</span>
        <span className="text-muted-foreground"> · {purpose}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-1">
          <FieldLabel>Type</FieldLabel>
          <RecordValue value={record.type} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <FieldLabel>Name / Host</FieldLabel>
          <RecordValue value={record.name} copyLabel="Copy host" />
          <span className="break-all text-xs text-muted-foreground">= {record.host}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <FieldLabel>Value / Target</FieldLabel>
          <RecordValue value={record.value} copyLabel="Copy value" />
          {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
        </div>
      </div>
    </section>
  );
};

interface DnsRecordsStepProps {
  guide?: IDomainSetupGuideItem;
  isLoading: boolean;
}

export const DnsRecordsStep = ({ guide, isLoading }: DnsRecordsStepProps) => {
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading DNS records…</p>;
  }

  if (!guide || guide.records.length === 0) {
    return (
      <p className="rounded-md border border-base-error bg-blocks-error-100 px-4 py-3 text-sm text-blocks-error-800">
        We couldn’t load the DNS records for this domain. Close this window and try again.
      </p>
    );
  }

  const apiRecord = guide.records.find((record) => record.purpose === "api");
  // The API record's name is always relative, so the zone is what its host adds to it
  const zone = apiRecord ? apiRecord.host.slice(apiRecord.name.length + 1) : guide.cookieDomain;
  const cnameTarget = apiRecord?.value;

  return (
    <div className="flex flex-col gap-4">
      {guide.isApex && (
        <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>
            <span className="font-semibold">{zone} is a root (apex) domain.</span> Most DNS
            providers don’t allow a CNAME on the root, so{" "}
            <strong>Record 1 is an A record on @</strong> instead.
          </p>
        </div>
      )}

      <p className="text-sm text-high-emphasis">
        Sign in to your DNS provider (Cloudflare, GoDaddy, Namecheap, Route 53…) and add these{" "}
        <strong>{guide.records.length} records</strong>. One points your app to Blocks, the other
        creates the API address your app will call.
      </p>

      {guide.records.map((record, index) => (
        <DnsRecordCard
          key={record.host}
          index={index}
          record={record}
          isApex={guide.isApex}
          cnameTarget={cnameTarget}
        />
      ))}

      <div className="flex gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
        <ul className="flex list-disc flex-col gap-1.5 pl-4 text-sm text-high-emphasis">
          <li>
            Enter the <strong>Name / Host</strong> exactly as shown. Most providers add{" "}
            <code className="font-mono">.{zone}</code> for you, so don’t type the full name.
          </li>
          {guide.isApex && (
            <li>
              Remove any existing A or AAAA record on <code className="font-mono">@</code> first, or
              it will conflict.
            </li>
          )}
          <li>
            Using Cloudflare? Set the proxy status to <strong>DNS only</strong> (grey cloud).
          </li>
          <li>DNS changes usually show up within minutes, but can take up to 48 hours.</li>
        </ul>
      </div>
    </div>
  );
};

import { AlertTriangle, Info } from "lucide-react";
import type { IDnsRecordInstruction, IDomainSetupGuideItem } from "@/models/domain-setup.model";
import { CopyValueButton } from "./copy-value-button";
import { useT, tStatic } from "@seliseblocks/genesis-os";

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
      ? tStatic("os.dashboard", "DNS_RECORDS_STEP.IP_ADDRESS_OF_TARGET", { target: cnameTarget })
      : undefined;
  }
  if (record.type === "ALIAS") {
    return tStatic("os.dashboard", "DNS_RECORDS_STEP.YOUR_PROVIDER_MUST_SUPPORT_ALIAS");
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
  const { t } = useT("os.dashboard");
  const purpose =
    record.purpose === "api"
      ? tStatic("os.dashboard", "DNS_RECORDS_STEP.BLOCKS_API_FOR_YOUR_APP")
      : isApex
        ? tStatic("os.dashboard", "DNS_RECORDS_STEP.YOUR_APP_ROOT_DOMAIN")
        : tStatic("os.dashboard", "DNS_RECORDS_STEP.YOUR_APP");
  const hint = valueHint(record, cnameTarget);

  return (
    <section
      aria-label={t("DNS_RECORDS_STEP.RECORD", { value1: index + 1 })}
      className="flex flex-col gap-3 rounded-lg border border-border p-4"
    >
      <p className="text-sm">
        <span className="font-semibold text-high-emphasis">{t("DNS_RECORDS_STEP.RECORD", { value1: index + 1 })}</span>
        <span className="text-muted-foreground"> · {purpose}</span>
      </p>
      <div className="grid gap-3 sm:grid-cols-[88px_minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-1">
          <FieldLabel>{t("common:TYPE")}</FieldLabel>
          <RecordValue value={record.type} />
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <FieldLabel>{t("DNS_RECORDS_STEP.NAME_HOST")}</FieldLabel>
          <RecordValue value={record.name} copyLabel={t("DNS_RECORDS_STEP.COPY_HOST")} />
          <span className="break-all text-xs text-muted-foreground">= {record.host}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-1">
          <FieldLabel>{t("DNS_RECORDS_STEP.VALUE_TARGET")}</FieldLabel>
          <RecordValue value={record.value} copyLabel={t("DNS_RECORDS_STEP.COPY_VALUE")} />
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
  const { t } = useT("os.dashboard");
  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t("DNS_RECORDS_STEP.LOADING_DNS_RECORDS")}</p>;
  }

  if (!guide || guide.records.length === 0) {
    return (
      <p className="rounded-md border border-base-error bg-blocks-error-100 px-4 py-3 text-sm text-blocks-error-800">
        {t("DNS_RECORDS_STEP.WE_COULDN_T_LOAD_THE")}
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
            {t("DNS_RECORDS_STEP.MOST_DNS_PROVIDERS_DON_T", {
              span: t("DNS_RECORDS_STEP.ZONE_IS_APEX", { zone }),
              strong: t("DNS_RECORDS_STEP.RECORD_1_IS_AN_A"),
            })}
          </p>
        </div>
      )}

      <p className="text-sm text-high-emphasis">
        {t("DNS_RECORDS_STEP.SIGN_IN_TO_YOUR_DNS", {
          strong: t("DNS_RECORDS_STEP.RECORDS_COUNT", { count: guide.records.length }),
        })}
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
            {t("DNS_RECORDS_STEP.ENTER_THE_EXACTLY_AS_SHOWN", { strong: t("DNS_RECORDS_STEP.NAME_HOST"), code: `.${zone}` })}</li>
          {guide.isApex && (
            <li>
              {t("DNS_RECORDS_STEP.REMOVE_ANY_EXISTING_A_OR", { code: "@" })}</li>
          )}
          <li>
            {t("DNS_RECORDS_STEP.USING_CLOUDFLARE_SET_THE_PROXY", { strong: t("DNS_RECORDS_STEP.DNS_ONLY") })}</li>
          <li>{t("DNS_RECORDS_STEP.DNS_CHANGES_USUALLY_SHOW_UP")}</li>
        </ul>
      </div>
    </div>
  );
};

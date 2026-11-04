import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DomainSetupPhase,
  DomainSetupSteps,
  IDomainSetupStepState,
} from "@/hooks/use-domain-setup";
import type { DomainSetupStepId, IDomainSetupGuideItem } from "@/models/domain-setup.model";
import { useT, tStatic } from "@seliseblocks/genesis-os";

const I18N_MODULE = "os.dashboard";

const StatusIcon = ({ state, skipped }: { state: IDomainSetupStepState; skipped: boolean }) => {
  switch (state.status) {
    case "done":
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400">
          <Check className="h-3.5 w-3.5" />
        </span>
      );
    case "failed":
      return (
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blocks-error-100 text-blocks-error-800">
          <X className="h-3.5 w-3.5" />
        </span>
      );
    case "running":
      return <Loader2 className="h-6 w-6 shrink-0 animate-spin text-primary" aria-hidden="true" />;
    default:
      return (
        <span
          className={cn(
            "h-6 w-6 shrink-0 rounded-full border border-border",
            skipped && "border-dashed",
          )}
        />
      );
  }
};

const STATUS_TEXT: Record<IDomainSetupStepState["status"], string> = {
  get pending() {
    return tStatic(I18N_MODULE, "SETUP_PROGRESS_STEP.WAITING");
  },
  get running() {
    return tStatic(I18N_MODULE, "SETUP_PROGRESS_STEP.IN_PROGRESS");
  },
  get done() {
    return tStatic(I18N_MODULE, "common:DONE");
  },
  get failed() {
    return tStatic(I18N_MODULE, "SETUP_PROGRESS_STEP.FAILED");
  },
};

interface ProgressRowProps {
  title: string;
  detail?: string;
  state: IDomainSetupStepState;
  /** The run ended before this step was reached. */
  skipped: boolean;
}

const ProgressRow = ({ title, detail, state, skipped }: ProgressRowProps) => {
  const { t } = useT(I18N_MODULE);
  return (
    <li
      className={cn(
        "flex items-start gap-3 border-b border-border px-4 py-3.5 last:border-0",
        state.status === "running" && "bg-muted/40",
      )}
    >
      <StatusIcon state={state} skipped={skipped} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span
          className={cn(
            "text-sm font-medium",
            state.status === "pending" ? "text-muted-foreground" : "text-high-emphasis",
          )}
        >
          {title}
        </span>
        {detail && (
          <span className="break-all font-mono text-xs text-muted-foreground">{detail}</span>
        )}
        {state.status === "failed" && state.message && (
          <span className="text-xs text-blocks-error-800">{state.message}</span>
        )}
      </div>
      <span
        className={cn(
          "shrink-0 text-xs font-medium",
          state.status === "done" && "text-green-700 dark:text-green-400",
          state.status === "running" && "text-primary",
          state.status === "failed" && "text-blocks-error-800",
          state.status === "pending" && "text-muted-foreground",
        )}
      >
        {skipped ? t("SETUP_PROGRESS_STEP.SKIPPED") : STATUS_TEXT[state.status]}
      </span>
    </li>
  );
};

interface SetupProgressStepProps {
  phase: DomainSetupPhase;
  steps: DomainSetupSteps;
  error: string | null;
  guide?: IDomainSetupGuideItem;
  /** The site host, for when the guide is not loaded. */
  host: string;
}

export const SetupProgressStep = ({ phase, steps, error, guide, host }: SetupProgressStepProps) => {
  const { t } = useT(I18N_MODULE);
  const appRecord = guide?.records.find((record) => record.purpose === "app");
  const apiRecord = guide?.records.find((record) => record.purpose === "api");
  const isFailed = phase === "failed";
  const failedDnsStep = (["app_dns", "api_dns"] as DomainSetupStepId[]).find(
    (step) => steps[step].status === "failed",
  );
  const failedRecord = failedDnsStep === "api_dns" ? apiRecord : appRecord;
  const failedRecordNumber = failedDnsStep === "api_dns" ? 2 : 1;
  let failureTitle = t("SETUP_PROGRESS_STEP.SETUP_DIDN_T_FINISH");
  if (failedDnsStep) {
    failureTitle = t("SETUP_PROGRESS_STEP.WE_COULDN_T_FIND_RECORD", { value1: failedRecordNumber });
  } else if (steps.ssl.status === "failed") {
    failureTitle = t("SETUP_PROGRESS_STEP.WE_COULDN_T_SECURE_YOUR");
  }

  return (
    <div className="flex flex-col gap-4">
      {isFailed ? (
        <div
          role="alert"
          className="rounded-lg border border-base-error bg-blocks-error-100 px-4 py-3 text-sm text-blocks-error-800"
        >
          <p className="font-semibold">{failureTitle}</p>
          <p>{error}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-high-emphasis">
            {t("SETUP_PROGRESS_STEP.SETTING_UP_YOUR_DOMAIN")}
          </h3>
          <p className="text-sm text-high-emphasis">
            {t("SETUP_PROGRESS_STEP.EACH_STEP_UPDATES_AS_SOON")}
          </p>
        </div>
      )}

      <ol
        aria-label={t("SETUP_PROGRESS_STEP.SETUP_PROGRESS")}
        className="rounded-lg border border-border"
      >
        <ProgressRow
          title={t("SETUP_PROGRESS_STEP.DNS_RECORD_FOR_YOUR_APP")}
          detail={appRecord?.host ?? host}
          state={steps.app_dns}
          skipped={isFailed && steps.app_dns.status === "pending"}
        />
        <ProgressRow
          title={t("SETUP_PROGRESS_STEP.DNS_RECORD_FOR_THE_API")}
          detail={apiRecord?.host}
          state={steps.api_dns}
          skipped={isFailed && steps.api_dns.status === "pending"}
        />
        <ProgressRow
          title={t("SETUP_PROGRESS_STEP.SSL_CERTIFICATE")}
          detail={
            steps.ssl.status === "running"
              ? tStatic(I18N_MODULE, "SETUP_PROGRESS_STEP.SECURING_YOUR_APP_AND_ITS")
              : undefined
          }
          state={steps.ssl}
          skipped={isFailed && steps.ssl.status === "pending"}
        />
      </ol>

      {isFailed && failedDnsStep && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-high-emphasis">
            {t("SETUP_PROGRESS_STEP.COMMON_CAUSES")}
          </p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-high-emphasis">
            <li>
              {t("SETUP_PROGRESS_STEP.WAIT_A_FEW_MINUTES_AND", {
                strong: t("SETUP_PROGRESS_STEP.DNS_HASN_T_UPDATED_YET"),
              })}
            </li>
            {failedRecord && failedRecord.name !== "@" && (
              <li>
                {t("SETUP_PROGRESS_STEP.MANY_PROVIDERS_ADD_THE_DOMAIN", {
                  strong: t("SETUP_PROGRESS_STEP.FULL_NAME_TYPED_AS_HOST"),
                  code: `${failedRecord.name}`,
                })}
              </li>
            )}
            {failedRecord && (
              <li>
                {t("SETUP_PROGRESS_STEP.IT_MUST_BE_EXACTLY", {
                  strong: t("SETUP_PROGRESS_STEP.TYPO_IN_THE_VALUE"),
                  code: `${failedRecord.value}`,
                })}
              </li>
            )}
            <li>
              {t("SETUP_PROGRESS_STEP.SWITCH_THE_RECORD_TO_DNS", {
                strong: t("SETUP_PROGRESS_STEP.CLOUDFLARE_PROXY_IS_ON"),
              })}
            </li>
          </ul>
        </div>
      )}

      {isFailed && steps.ssl.status === "failed" && (
        <p className="text-sm text-high-emphasis">
          {t("SETUP_PROGRESS_STEP.BOTH_DNS_RECORDS_WERE_FOUND")}
        </p>
      )}
    </div>
  );
};

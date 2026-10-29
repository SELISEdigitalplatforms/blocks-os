import { Check, Loader2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  DomainSetupPhase,
  DomainSetupSteps,
  IDomainSetupStepState,
} from "@/hooks/use-domain-setup";
import type { DomainSetupStepId, IDomainSetupGuideItem } from "@/models/domain-setup.model";

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
  pending: "Waiting",
  running: "In progress",
  done: "Done",
  failed: "Failed",
};

interface ProgressRowProps {
  title: string;
  detail?: string;
  state: IDomainSetupStepState;
  /** The run ended before this step was reached. */
  skipped: boolean;
}

const ProgressRow = ({ title, detail, state, skipped }: ProgressRowProps) => (
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
      {skipped ? "Skipped" : STATUS_TEXT[state.status]}
    </span>
  </li>
);

interface SetupProgressStepProps {
  phase: DomainSetupPhase;
  steps: DomainSetupSteps;
  error: string | null;
  guide?: IDomainSetupGuideItem;
  /** The site host, for when the guide is not loaded. */
  host: string;
}

export const SetupProgressStep = ({ phase, steps, error, guide, host }: SetupProgressStepProps) => {
  const appRecord = guide?.records.find((record) => record.purpose === "app");
  const apiRecord = guide?.records.find((record) => record.purpose === "api");
  const isFailed = phase === "failed";
  const failedDnsStep = (["app_dns", "api_dns"] as DomainSetupStepId[]).find(
    (step) => steps[step].status === "failed",
  );
  const failedRecord = failedDnsStep === "api_dns" ? apiRecord : appRecord;

  return (
    <div className="flex flex-col gap-4">
      {isFailed ? (
        <div
          role="alert"
          className="rounded-lg border border-base-error bg-blocks-error-100 px-4 py-3 text-sm text-blocks-error-800"
        >
          <p className="font-semibold">
            {failedDnsStep
              ? `We couldn’t find Record ${failedDnsStep === "api_dns" ? 2 : 1} yet`
              : steps.ssl.status === "failed"
                ? "We couldn’t secure your domain"
                : "Setup didn’t finish"}
          </p>
          <p>{error}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <h3 className="text-base font-semibold text-high-emphasis">Setting up your domain…</h3>
          <p className="text-sm text-high-emphasis">
            Each step updates as soon as it finishes. This usually takes under a minute.
          </p>
        </div>
      )}

      <ol aria-label="Setup progress" className="rounded-lg border border-border">
        <ProgressRow
          title="DNS record for your app"
          detail={appRecord?.host ?? host}
          state={steps.app_dns}
          skipped={isFailed && steps.app_dns.status === "pending"}
        />
        <ProgressRow
          title="DNS record for the API"
          detail={apiRecord?.host}
          state={steps.api_dns}
          skipped={isFailed && steps.api_dns.status === "pending"}
        />
        <ProgressRow
          title="SSL certificate"
          detail={
            steps.ssl.status === "running" ? "Securing your app and its API with HTTPS" : undefined
          }
          state={steps.ssl}
          skipped={isFailed && steps.ssl.status === "pending"}
        />
      </ol>

      {isFailed && failedDnsStep && (
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-high-emphasis">Common causes</p>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-high-emphasis">
            <li>
              <strong>DNS hasn’t updated yet.</strong> Wait a few minutes and try again. It can take
              up to 48 hours.
            </li>
            {failedRecord && failedRecord.name !== "@" && (
              <li>
                <strong>Full name typed as Host.</strong> Many providers add the domain for you.
                Enter only <code className="font-mono">{failedRecord.name}</code>.
              </li>
            )}
            {failedRecord && (
              <li>
                <strong>Typo in the value.</strong> It must be exactly{" "}
                <code className="font-mono">{failedRecord.value}</code>.
              </li>
            )}
            <li>
              <strong>Cloudflare proxy is on.</strong> Switch the record to DNS only (grey cloud).
            </li>
          </ul>
        </div>
      )}

      {isFailed && steps.ssl.status === "failed" && (
        <p className="text-sm text-high-emphasis">
          Both DNS records were found, but the certificate could not be issued. Check that both
          records point to Blocks and that no proxy sits in front of them, then try again.
        </p>
      )}
    </div>
  );
};

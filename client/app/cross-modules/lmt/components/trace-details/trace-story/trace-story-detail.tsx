import { ArrowRight, FileText, Pin, PinOff } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { formatDurationMs } from "@blocks-lmt/utils";
import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import { TracingInfo } from "../tracing-insights/tracing-info";
import type { describeTransfer } from "./trace-story-narration";
import { pinKey, type StoryPin } from "./trace-story-pins";
import { TRAFFIC_LABEL } from "./trace-story-row";
import { logServiceOf } from "./trace-story.util";

type Narration = ReturnType<typeof describeTransfer>;

const stateBadge = (step: FlowStep) => {
  if (step.state === "error") return { variant: "error" as const, label: "Failed" };
  if (step.state === "warning") return { variant: "warning" as const, label: "Warning" };
  if (step.state === "ok") return { variant: "success" as const, label: "Succeeded" };
  return { variant: "secondary" as const, label: "Outcome not recorded" };
};

const ErrorNote = ({
  step,
  onSelectStep,
}: {
  step: FlowStep;
  onSelectStep: (index: number) => void;
}) => {
  const cause = step.causedByIndex;
  if (!step.errorMessage && cause === null) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md bg-error/10 p-3 text-xs text-error" role="note">
      {step.errorMessage ? (
        <p className="break-words font-mono">
          {step.isErrorOrigin ? "Error started here: " : "Reported error: "}
          {step.errorMessage}
        </p>
      ) : null}
      {cause === null ? null : (
        <button
          type="button"
          className="self-start font-semibold hover:underline"
          onClick={() => onSelectStep(cause)}
        >
          Failed because of step {cause + 1} →
        </button>
      )}
    </div>
  );
};

export const TraceStoryDetail = ({
  step,
  total,
  from,
  to,
  narration,
  startOffsetMs,
  pins,
  onTogglePin,
  onSelectStep,
  onOpenLogs,
}: {
  step: FlowStep;
  total: number;
  from: string;
  to: string;
  narration: Narration;
  startOffsetMs: number | null;
  pins: StoryPin[];
  onTogglePin: (pin: StoryPin) => void;
  onSelectStep: (index: number) => void;
  onOpenLogs: () => void;
}) => {
  const badge = stateBadge(step);
  const facts = [
    ...(startOffsetMs === null
      ? []
      : [{ label: "Started", value: `+${formatDurationMs(startOffsetMs)}` }]),
    { label: "Took", value: formatDurationMs(step.durationMs) },
    { label: "Status", value: step.statusLabel },
    ...narration.facts,
  ];
  const pinned = new Set(pins.map(pinKey));
  return (
    <aside
      aria-label="Selected step"
      className="flex min-w-0 flex-col gap-4 p-4"
      aria-live="polite"
    >
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-low-emphasis">
        <span>
          Step {step.index + 1} of {total}
        </span>
        <span>{TRAFFIC_LABEL[step.traffic]}</span>
      </div>
      <div className="flex flex-col gap-2">
        <h3 className="text-lg font-semibold leading-snug text-high-emphasis">{narration.title}</h3>
        <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px] text-medium-emphasis">
          <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5">{from}</span>
          <ArrowRight size={12} aria-hidden />
          <span className="break-all">{step.tag}</span>
          <ArrowRight size={12} aria-hidden />
          <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5">{to}</span>
        </div>
        <p className="text-sm leading-relaxed text-high-emphasis">{narration.description}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={badge.variant} className="py-0">
            {badge.label}
          </Badge>
          <span className="text-xs text-medium-emphasis">{narration.outcome}</span>
        </div>
      </div>
      <ErrorNote step={step} onSelectStep={onSelectStep} />
      <dl className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 text-xs">
        {facts.map((fact) => {
          const pin = { stepIndex: step.index, label: fact.label, value: fact.value };
          const isPinned = pinned.has(pinKey(pin));
          return (
            <div key={fact.label} className="contents">
              <dt className="text-low-emphasis">{fact.label}</dt>
              <dd className="break-words font-mono text-high-emphasis">{fact.value}</dd>
              <dd>
                <button
                  type="button"
                  className="rounded p-1 text-low-emphasis hover:bg-muted/50 hover:text-high-emphasis"
                  aria-pressed={isPinned}
                  aria-label={`${isPinned ? "Unpin" : "Pin"} ${fact.label}`}
                  onClick={() => onTogglePin(pin)}
                >
                  {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
                </button>
              </dd>
            </div>
          );
        })}
      </dl>
      <button
        type="button"
        onClick={onOpenLogs}
        className="flex w-full items-center justify-between gap-3 rounded-md border border-border bg-muted/30 px-3 py-2.5 text-left hover:border-primary"
      >
        <span className="flex items-center gap-2">
          <FileText size={15} className="text-medium-emphasis" aria-hidden />
          <span className="flex flex-col">
            <span className="text-sm font-semibold text-high-emphasis">Logs</span>
            <span className="text-xs text-medium-emphasis">
              Records from {logServiceOf(step) || "this service"} during this step
            </span>
          </span>
        </span>
        <ArrowRight size={14} aria-hidden />
      </button>
      <details className="group rounded-md border border-border">
        <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-high-emphasis">
          Technical details
        </summary>
        <div className="border-t border-border p-3">
          <TracingInfo />
        </div>
      </details>
    </aside>
  );
};

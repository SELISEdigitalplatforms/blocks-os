import { forwardRef } from "react";
import { cn } from "@/lib/utils";
import { formatDurationMs } from "@blocks-lmt/utils";
import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import { timelineGridStyle } from "../timeline-axis";
import type { StepTiming } from "./trace-story.util";

/** The waterfall's three columns -- what happened, when, how long -- shared by the axis
 *  header and every row so the bars line up under the axis stops. */
export const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_64px] gap-x-3 gap-y-1.5 md:grid-cols-[minmax(0,1fr)_minmax(160px,38%)_72px]";

export const TRAFFIC_BAR: Record<FlowStep["traffic"], string> = {
  http: "bg-chart-yellow",
  call: "bg-chart-blue",
  data: "bg-chart-purple",
  cache: "bg-chart-magenta",
  message: "bg-chart-orange",
};

export const TRAFFIC_LABEL: Record<FlowStep["traffic"], string> = {
  http: "Request",
  call: "Call",
  data: "Database",
  cache: "Cache",
  message: "Message",
};

const MAX_INDENT = 6;

const barColor = (step: FlowStep) => {
  if (step.state === "error") return "bg-error";
  if (step.state === "warning") return "bg-warning";
  return TRAFFIC_BAR[step.traffic];
};

const StateTag = ({ step }: { step: FlowStep }) => {
  if (step.isErrorOrigin)
    return (
      <span className="rounded bg-error/10 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-error">
        Error started here
      </span>
    );
  if (step.state === "error")
    return (
      <span className="rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide text-error">
        Failed
      </span>
    );
  return null;
};

export const TraceStoryRow = forwardRef<
  HTMLButtonElement,
  {
    step: FlowStep;
    title: string;
    description: string;
    timing: StepTiming;
    selected: boolean;
    onSelect: () => void;
  }
>(({ step, title, description, timing, selected, onSelect }, ref) => (
  <button
    ref={ref}
    type="button"
    onClick={onSelect}
    aria-pressed={selected}
    aria-label={`Step ${step.index + 1}: ${title}. ${step.tag}. ${formatDurationMs(step.durationMs)}`}
    className={cn(
      ROW_GRID,
      "w-full items-center border-b border-l-2 border-b-border border-l-transparent px-3 py-2 text-left transition-colors",
      "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
      selected ? "bg-primary/10 border-l-primary" : "hover:bg-muted/40",
      step.isErrorOrigin && "border-l-error",
    )}
  >
    <span
      className="flex min-w-0 flex-col"
      style={{ paddingLeft: `${Math.min(step.depth, MAX_INDENT) * 12}px` }}
    >
      <span className="flex min-w-0 flex-wrap items-center gap-x-2">
        <span className="font-mono text-[11px] tabular-nums text-low-emphasis">
          {step.index + 1}
        </span>
        <span className="truncate text-sm font-semibold text-high-emphasis">{title}</span>
        <StateTag step={step} />
      </span>
      <span className="truncate text-xs text-medium-emphasis" title={description}>
        {description}
      </span>
    </span>
    <span
      className="relative order-last col-span-2 h-3.5 self-center rounded-sm border-r border-border bg-muted/30 md:order-none md:col-span-1"
      style={timelineGridStyle()}
      aria-hidden
    >
      {timing.untimed ? (
        <span className="absolute inset-0 flex items-center px-1 text-[10px] text-low-emphasis">
          Time not recorded
        </span>
      ) : (
        <span
          className={cn("absolute top-0.5 bottom-0.5 rounded-[2px]", barColor(step))}
          style={{
            left: `${timing.offsetPercent}%`,
            width: `${timing.widthPercent}%`,
            // Sub-millisecond spans would round away; they stay visible as a tick.
            minWidth: "3px",
          }}
        />
      )}
    </span>
    <span className="text-right font-mono text-xs tabular-nums text-medium-emphasis">
      {formatDurationMs(step.durationMs)}
      {timing.skewed ? (
        <span
          className="block text-[10px] text-warning"
          title="This span starts before the step that called it. The services' clocks disagree."
        >
          clock skew
        </span>
      ) : null}
    </span>
  </button>
));
TraceStoryRow.displayName = "TraceStoryRow";

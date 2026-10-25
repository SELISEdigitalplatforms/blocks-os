import { forwardRef } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDurationMs } from "@blocks-lmt/utils";
import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import { timelineGridStyle } from "../timeline-axis";
import { plural, type ServiceLevel, type StepTiming } from "./trace-story.util";

/** The waterfall's three columns -- what happened, when, how long -- shared by the axis
 *  header and every row so the bars line up under the axis stops. */
export const ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_64px] gap-x-3 gap-y-1.5 md:grid-cols-[minmax(0,1fr)_minmax(160px,36%)_72px]";

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
      <span className="shrink-0 rounded bg-error/10 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-error">
        Error started here
      </span>
    );
  if (step.state === "error")
    return (
      <span className="shrink-0 rounded px-1.5 text-[10px] font-semibold uppercase tracking-wide text-error">
        Failed
      </span>
    );
  return null;
};

/** "+2.4 s": how long after the publishing step an event's consumer started. */
export const formatDelay = (ms: number) => `+${formatDurationMs(Math.max(ms, 0))}`;

const OpenLevel = ({ level, onOpen }: { level: ServiceLevel; onOpen: () => void }) => (
  <button
    type="button"
    onClick={onOpen}
    className={cn(
      "relative z-10 inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold hover:bg-muted/50",
      level.isEvent ? "border-dashed" : "border-solid",
      level.hasError ? "border-error/40 text-error" : "border-border text-primary",
    )}
  >
    Open {level.service} · {plural(level.totalSteps, "step")}
    <ChevronRight size={12} aria-hidden />
  </button>
);

export const TraceStoryRow = forwardRef<
  HTMLButtonElement,
  {
    step: FlowStep;
    number: number;
    indent: number;
    title: string;
    description: string;
    timing: StepTiming;
    selected: boolean;
    opens: ServiceLevel[];
    onSelect: () => void;
    onOpen: (level: ServiceLevel) => void;
  }
>(
  (
    { step, number, indent, title, description, timing, selected, opens, onSelect, onOpen },
    ref,
  ) => {
    const event = opens.find((level) => level.isEvent && level.delayMs !== null);
    return (
      <div
        className={cn(
          ROW_GRID,
          "relative w-full items-center border-b border-l-2 border-b-border border-l-transparent px-3 py-2 transition-colors",
          selected ? "border-l-primary bg-primary/10" : "hover:bg-muted/40",
          selected && step.state === "error" && "border-l-error",
        )}
      >
        <span
          className="flex min-w-0 flex-col gap-0.5"
          style={{ paddingLeft: `${Math.min(indent, MAX_INDENT) * 12}px` }}
        >
          {/* The row's own button stretches over the whole row, so a click anywhere selects
            the step; "Open" sits above it and goes into the other service instead. */}
          <button
            ref={ref}
            type="button"
            onClick={onSelect}
            aria-pressed={selected}
            aria-label={`Step ${number}: ${title}. ${step.tag}. ${formatDurationMs(step.durationMs)}`}
            className="flex min-w-0 flex-col text-left after:absolute after:inset-0 focus-visible:outline-hidden focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-ring"
          >
            <span className="flex min-w-0 items-center gap-x-2">
              <span className="font-mono text-[11px] tabular-nums text-low-emphasis">{number}</span>
              <span className="truncate text-sm font-semibold text-high-emphasis">{title}</span>
              <StateTag step={step} />
            </span>
            <span className="truncate text-xs text-medium-emphasis" title={description}>
              {description}
            </span>
          </button>
          {opens.length ? (
            <span className="flex flex-wrap gap-1.5">
              {opens.map((level) => (
                <OpenLevel key={level.id} level={level} onOpen={() => onOpen(level)} />
              ))}
            </span>
          ) : null}
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
          {event?.delayMs == null ? null : (
            <span className="absolute -top-px right-0 rounded-sm border border-dashed border-border-medium-emphasis bg-card px-1 font-mono text-[10px] leading-[14px] text-medium-emphasis">
              → {formatDelay(event.delayMs)}
            </span>
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
      </div>
    );
  },
);
TraceStoryRow.displayName = "TraceStoryRow";

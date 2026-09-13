import { useContext, useMemo } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui-kits/tooltip/tooltip";
import { cn, formatDate, parseDateString } from "@/lib/utils";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { formatDurationMs } from "@blocks-lmt/utils";
import { getTraceStatus, TraceTree } from "@blocks-lmt/models/trace.model";
import { TimelineAxis, timelineGridStyle } from "../timeline-axis";
import { timelineContext } from "../trace-details";

/** The waterfall is three columns wide -- span name, plot, duration -- and the axis header
 *  reuses the same gutters so its stops land on the hairlines beneath them. */
const NAME_COLUMN = "hidden w-[136px] shrink-0 pr-3 sm:block";
const DURATION_COLUMN = "w-[76px] shrink-0 pl-3";
const ROW_HEIGHT = "h-8";

const LoadingSkelton = () => (
  <div className="rounded-md border border-border p-3">
    <Skeleton className="h-4 w-full" />
    <div className="mt-3 flex flex-col gap-3">
      <Skeleton className="h-2 w-full" />
      <Skeleton className="h-2 w-2/3" />
    </div>
  </div>
);

interface SpanRow {
  spanId: string;
  label: string;
  serviceName: string;
  startTime: string;
  endTime: string;
  duration: number;
  status: ReturnType<typeof getTraceStatus>;
  isError: boolean;
  /** Left edge and length as percentages of the root span, so the chart reflows with the
   *  card instead of having to be re-measured whenever the insights panel toggles. */
  offsetPercent: number;
  widthPercent: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const buildSpanRow = (item: TraceTree, totalDuration: number, originMs: number): SpanRow => {
  const scale = totalDuration > 0 ? 100 / totalDuration : 0;
  const offsetPercent = clamp((Number(new Date(item.startTime)) - originMs) * scale, 0, 100);
  const status = getTraceStatus(item);

  return {
    spanId: item.spanId,
    label: item.operationName || item.activitySourceName || item.serviceName,
    serviceName: item.serviceName,
    startTime: item.startTime,
    endTime: item.endTime,
    duration: item.duration,
    status,
    isError: status.variant === "error",
    offsetPercent,
    widthPercent: clamp(item.duration * scale, 0, 100 - offsetPercent),
  };
};

const TooltipRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex items-baseline justify-between gap-6">
    <span className="text-low-emphasis">{label}</span>
    <span className="tabular-nums text-high-emphasis">{children}</span>
  </div>
);

const SpanBar = ({ row }: { row: SpanRow }) => {
  const { selectedTrace, setSelectedTrace, traceHistory } = useContext(timelineContext);
  const isSelected = selectedTrace?.spanId === row.spanId;

  // Clicking a bar selects the span the activity list below selects, so the two halves of
  // the card never disagree about which span the insights panel is describing.
  const selectSpan = () => {
    const current = traceHistory[traceHistory.length - 1]?.current;
    if (!current) return;
    const match =
      current.spanId === row.spanId
        ? current
        : current.subEntries?.find((entry) => entry.spanId === row.spanId);
    if (match) setSelectedTrace({ ...match });
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={selectSpan}
            aria-pressed={isSelected}
            aria-label={`${row.label}, ${formatDurationMs(row.duration)}`}
            className={cn(
              "group flex w-full items-center rounded-sm text-left transition-colors",
              ROW_HEIGHT,
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              // The selected row is tinted with the span's own hue rather than with `muted`,
              // which in dark mode is the same value as `border` -- it would paint out the
              // gridlines the row is meant to be read against.
              isSelected
                ? row.isError
                  ? "bg-error/10"
                  : "bg-chart-purple/10"
                : "hover:bg-muted/40",
            )}
          >
            <span
              className={cn(
                NAME_COLUMN,
                "truncate text-[11px] font-medium",
                isSelected ? "text-high-emphasis" : "text-medium-emphasis",
              )}
              title={`${row.serviceName} - ${row.label}`}
            >
              {row.label}
            </span>
            {/* Hairlines are painted onto the plot cell itself rather than an overlay, so
                touching rows join into one continuous gridline down the chart. */}
            <span
              className="relative min-w-0 flex-1 self-stretch border-r border-border"
              style={timelineGridStyle()}
            >
              <span
                className={cn(
                  "absolute top-1/2 h-2 -translate-y-1/2 rounded-[2px] transition-colors",
                  row.isError
                    ? isSelected
                      ? "bg-error"
                      : "bg-error/40 group-hover:bg-error/70"
                    : isSelected
                      ? "bg-chart-purple"
                      : "bg-chart-purple/40 group-hover:bg-chart-purple/70",
                )}
                style={{
                  left: `${row.offsetPercent}%`,
                  width: `${row.widthPercent}%`,
                  // Sub-millisecond spans round to a fraction of a percent and would
                  // disappear; they stay legible as a tick at the moment they occurred.
                  minWidth: "3px",
                }}
              />
            </span>
            <span
              className={cn(
                DURATION_COLUMN,
                "truncate text-right text-[11px] tabular-nums",
                isSelected ? "text-high-emphasis" : "text-medium-emphasis",
              )}
            >
              {formatDurationMs(row.duration)}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs">
          <div className="flex flex-col gap-1 text-xs">
            <p className="mb-1 break-all font-medium text-high-emphasis">{row.label}</p>
            <TooltipRow label="Service">{row.serviceName}</TooltipRow>
            <TooltipRow label="Status">{row.status.label}</TooltipRow>
            <TooltipRow label="Start">{formatDate(parseDateString(row.startTime))}</TooltipRow>
            <TooltipRow label="End">{formatDate(parseDateString(row.endTime))}</TooltipRow>
            <TooltipRow label="Duration">{formatDurationMs(row.duration)}</TooltipRow>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const TracingDistributedContent = ({ trace }: { trace: TraceTree }) => {
  const spanRows = useMemo(() => {
    if (!trace) return [];
    const originMs = Number(new Date(trace.startTime));
    return [
      buildSpanRow(trace, trace.duration, originMs),
      ...(trace.subEntries?.map((item) => buildSpanRow(item, trace.duration, originMs)) ?? []),
    ];
  }, [trace]);

  return (
    <div className="w-full rounded-md border border-border px-3 pb-1 pt-3">
      <div className="flex items-end">
        <span className={NAME_COLUMN} aria-hidden />
        {/* Matches the 1px right border the plot cells carry, so the header and the rows
            resolve to the same content width and the stops sit on their own hairlines. */}
        <div className="min-w-0 flex-1 border-r border-transparent">
          <TimelineAxis duration={trace.duration} />
        </div>
        <span className={DURATION_COLUMN} aria-hidden />
      </div>
      {/* No padding between the rule and the first row: the rows have to touch each other and
          the axis for their hairlines to join into one continuous gridline. */}
      <div className="mt-1 border-t border-border">
        {spanRows.map((row) => (
          <SpanBar key={row.spanId} row={row} />
        ))}
      </div>
    </div>
  );
};

export const TracingDistributedTimeline = () => {
  const { traceHistory, isLoading } = useContext(timelineContext);
  if (isLoading) return <LoadingSkelton />;
  if (!traceHistory.length) return <LoadingSkelton />;
  const trace = traceHistory[traceHistory?.length - 1].current;
  return <TracingDistributedContent trace={trace} />;
};

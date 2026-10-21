import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Info } from "lucide-react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { cn, formatDate, parseDateString } from "@/lib/utils";
import { formatDurationMs } from "@blocks-lmt/utils";
import { getTraceStatus, type TraceTree } from "@blocks-lmt/models/trace.model";
import { buildTraceFlow, type TraceFlow } from "@blocks-lmt/utils/trace-flow.util";
import { TimelineAxis } from "../timeline-axis";
import { timelineContext } from "../trace-details";
import { describeTransfer } from "./trace-story-narration";
import { TraceStoryDetail } from "./trace-story-detail";
import { TraceStoryLogs } from "./trace-story-logs";
import {
  formatDelay,
  ROW_GRID,
  TRAFFIC_BAR,
  TRAFFIC_LABEL,
  TraceStoryRow,
} from "./trace-story-row";
import {
  buildPlotLine,
  buildServiceLevels,
  buildTimeline,
  getErrorPath,
  getLevelPath,
  getParentIndexes,
  getTraceOriginMs,
  plural,
  type PlotLine,
  type ServiceLevel,
  type ServiceSummary,
} from "./trace-story.util";

const shortId = (value?: string) => (value && value.length > 10 ? `${value.slice(0, 8)}…` : value);

const Dot = () => (
  <span aria-hidden className="text-low-emphasis">
    ·
  </span>
);

const TraceHeader = ({
  root,
  flow,
  services,
}: {
  root: TraceTree;
  flow: TraceFlow;
  services: number;
}) => {
  const status = getTraceStatus(root);
  const method = root.entryPoint?.method;
  const action = root.entryPoint?.actionName || flow.steps[0]?.tag;
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {method ? (
            <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-[11px] font-medium uppercase text-medium-emphasis">
              {method}
            </span>
          ) : null}
          <h2 className="truncate text-xl font-semibold text-high-emphasis" title={action}>
            {action}
          </h2>
        </div>
        <p className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-medium-emphasis">
          <span>{formatDate(parseDateString(root.startTime))}</span>
          <Dot />
          <span className="font-semibold text-high-emphasis">
            {formatDurationMs(root.duration)}
          </span>
          <Dot />
          <span>
            <span className="font-semibold text-high-emphasis">
              {plural(flow.totalSpans, "step")}
            </span>{" "}
            in {plural(services, "service")}
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2.5">
        <Badge variant={status.variant} className="tabular-nums">
          {status.label}
        </Badge>
        <CopyToClipboardButton textToCopy={root.traceId} label="Copy trace ID" isHoverable>
          <span className="font-mono text-xs text-medium-emphasis">{shortId(root.traceId)}</span>
        </CopyToClipboardButton>
      </div>
    </div>
  );
};

const ServiceChips = ({
  services,
  current,
  onPick,
}: {
  services: ServiceSummary[];
  current: string;
  onPick: (service: ServiceSummary) => void;
}) => (
  <nav aria-label="Services" className="flex flex-wrap items-center gap-2">
    <span className="mr-1 text-[11px] font-medium uppercase tracking-wider text-low-emphasis">
      Services
    </span>
    {services.map((service) => {
      const pressed = service.service === current;
      return (
        <button
          key={service.service}
          type="button"
          aria-pressed={pressed}
          onClick={() => onPick(service)}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs text-high-emphasis",
            pressed
              ? "border-primary bg-primary/10 font-semibold"
              : "border-border font-medium hover:bg-muted/50",
          )}
        >
          <span
            aria-hidden
            className={cn("h-1.5 w-1.5 rounded-full", service.hasError ? "bg-error" : "bg-success")}
          />
          <span>{service.service}</span>
          <span className="font-mono text-[11px] text-low-emphasis">{service.steps}</span>
          {service.eventOnly ? (
            <span className="rounded border border-dashed border-border-medium-emphasis px-1 text-[10px] font-semibold uppercase text-medium-emphasis">
              event
            </span>
          ) : null}
          {service.hasError ? <span className="sr-only">has a failed step</span> : null}
        </button>
      );
    })}
  </nav>
);

const Legend = () => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 py-3 text-[11px] text-medium-emphasis">
    {(Object.keys(TRAFFIC_BAR) as (keyof typeof TRAFFIC_BAR)[]).map((traffic) => (
      <span key={traffic} className="inline-flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", TRAFFIC_BAR[traffic])} aria-hidden />
        <span>{TRAFFIC_LABEL[traffic]}</span>
      </span>
    ))}
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
      <span>Warning</span>
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-error" aria-hidden />
      <span>Failed</span>
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="font-semibold text-primary">Open ›</span>
      <span>shows the steps of the service it calls</span>
    </span>
  </div>
);

/** One neutral line that points the reader at what matters, without a pass/fail banner. */
const PlotLineNote = ({ plot }: { plot: PlotLine }) => (
  <p className="flex items-start gap-2 text-sm text-medium-emphasis">
    <Info size={15} className="mt-0.5 shrink-0 text-low-emphasis" aria-hidden />
    <span className="min-w-0 break-words">
      {plot.headline ? (
        <span className="font-medium text-high-emphasis">{plot.headline}</span>
      ) : null}{" "}
      {plot.detail}
    </span>
  </p>
);

const StoryNotes = ({ flow, skewCount }: { flow: TraceFlow; skewCount: number }) => {
  if (!flow.truncated && skewCount === 0) return null;
  return (
    <div className="flex flex-col gap-1 px-5 pb-3 text-xs text-medium-emphasis">
      {flow.truncated ? (
        <p>
          Showing {flow.steps.length} of {flow.totalSpans} steps. Failed steps and the steps that
          led to them are always kept.
        </p>
      ) : null}
      {skewCount > 0 ? (
        <p>
          {plural(skewCount, "step")} start before the step that called them. The services&apos;
          clocks disagree, so those bars are placed by their own clock.
        </p>
      ) : null}
    </div>
  );
};

const useStoryModel = (flow: TraceFlow) => {
  const labels = useMemo(() => new Map(flow.nodes.map((node) => [node.id, node.label])), [flow]);
  const parents = useMemo(() => getParentIndexes(flow.steps), [flow]);
  const levels = useMemo(() => buildServiceLevels(flow, parents), [flow, parents]);
  const errorPath = useMemo(() => getErrorPath(flow, parents), [flow, parents]);
  const originMs = useMemo(() => getTraceOriginMs(flow), [flow]);
  const narrations = useMemo(
    () =>
      flow.steps.map((step) =>
        describeTransfer(step, labels.get(step.fromId) ?? "", labels.get(step.toId) ?? ""),
      ),
    [flow, labels],
  );
  const spanIndex = useMemo(() => new Map(flow.steps.map((step) => [step.spanId, step])), [flow]);
  const labelOf = (id: string) => labels.get(id) ?? id;
  return { labelOf, parents, levels, errorPath, originMs, narrations, spanIndex };
};

const LevelBar = ({
  path,
  level,
  durationMs,
  errorPathOnly,
  onGoTo,
  onToggleErrorPath,
}: {
  path: ServiceLevel[];
  level: ServiceLevel;
  durationMs: number;
  errorPathOnly: boolean;
  onGoTo: (depth: number) => void;
  onToggleErrorPath: () => void;
}) => (
  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border px-5 py-2.5">
    <Button
      variant="outline"
      size="icon"
      type="button"
      className="h-8 w-8"
      aria-label="Back to the calling service"
      disabled={path.length < 2}
      onClick={() => onGoTo(path.length - 2)}
    >
      <ChevronLeft size={15} />
    </Button>
    <nav aria-label="Service path" className="flex min-w-0 flex-wrap items-center gap-1.5 text-sm">
      {path.map((item, depth) => {
        const current = depth === path.length - 1;
        const label = item.isEvent ? `${item.service} (event)` : item.service;
        return (
          <span key={item.id} className="inline-flex items-center gap-1.5">
            {depth > 0 ? (
              <ChevronRight size={13} className="text-low-emphasis" aria-hidden />
            ) : null}
            {current ? (
              <span aria-current="location" className="font-semibold text-high-emphasis">
                {label}
              </span>
            ) : (
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => onGoTo(depth)}
              >
                {label}
              </button>
            )}
          </span>
        );
      })}
    </nav>
    <span className="font-mono text-xs tabular-nums text-medium-emphasis">
      {plural(level.steps.length, "step")} · {formatDurationMs(durationMs)}
    </span>
    {level.hasError ? (
      <Button
        variant="outline"
        size="sm"
        type="button"
        className="ml-auto h-8"
        aria-pressed={errorPathOnly}
        onClick={onToggleErrorPath}
      >
        {errorPathOnly ? "Show all steps" : "Only the path to the error"}
      </Button>
    ) : null}
  </div>
);

const EventNote = ({ level, caller }: { level: ServiceLevel; caller?: string }) => (
  <p className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5 text-xs text-medium-emphasis">
    {level.delayMs === null ? null : (
      <span className="rounded border border-dashed border-border-medium-emphasis px-1.5 font-mono text-[11px]">
        {formatDelay(level.delayMs)}
      </span>
    )}
    <span>
      {level.delayMs === null
        ? `This event runs on its own clock.`
        : `This event ran ${formatDelay(level.delayMs).slice(1)} after ${caller ?? "the caller"} published it.`}{" "}
      0 ms here is when {level.service} picked it up.
    </span>
  </p>
);

const TraceStory = ({ root, flow }: { root: TraceTree; flow: TraceFlow }) => {
  const { setSelectedTrace, requestId } = useContext(timelineContext);
  const model = useStoryModel(flow);
  const { labelOf, parents, levels, errorPath, narrations } = model;

  const [index, setIndex] = useState(Math.max(flow.errorOriginIndex, 0));
  const [errorPathOnly, setErrorPathOnly] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const selectedRow = useRef<HTMLButtonElement>(null);

  const step = flow.steps[index];
  const level = levels.levels[levels.levelOf[index]];
  const path = useMemo(() => getLevelPath(levels.levels, level.id), [levels, level]);
  const timeline = useMemo(() => buildTimeline(flow, parents, level.steps), [flow, parents, level]);
  const timingOf = useMemo(
    () => new Map(level.steps.map((i, at) => [i, timeline.timings[at]])),
    [level, timeline],
  );
  const visible =
    errorPathOnly && level.hasError ? level.steps.filter((i) => errorPath.has(i)) : level.steps;
  const rootDepth = flow.steps[level.rootIndex].depth;

  useEffect(() => {
    setSelectedTrace({ ...step.span });
  }, [step, setSelectedTrace]);

  // Keep the selected row inside the list's own scroll area without scrolling the page.
  useEffect(() => {
    const row = selectedRow.current?.closest<HTMLElement>("[data-story-row]");
    const box = list.current;
    if (!row || !box || box.scrollHeight <= box.clientHeight) return;
    if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
  }, [index]);

  const pick = (next: number) => {
    if (next >= 0 && next < flow.steps.length) setIndex(next);
  };
  // Going up a level selects the step that led down, so the reader lands where they left.
  const goTo = (depth: number) => {
    const below = path[depth + 1];
    if (below) pick(below.enteredFrom);
  };
  const toggleErrorPath = () => {
    const next = !errorPathOnly;
    setErrorPathOnly(next);
    if (!next || errorPath.has(index)) return;
    const first = level.steps.find((i) => errorPath.has(i));
    if (first !== undefined) pick(first);
  };

  const timing = timingOf.get(index);
  const startOffsetMs =
    !timing || timing.untimed ? null : Date.parse(step.startTime) - timeline.originMs;
  const parentIndex = parents[index];
  const position = level.steps.indexOf(index);
  const caller = levels.levels[level.parentLevel]?.service;

  return (
    <section
      aria-label="Trace story"
      className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:bg-muted/40"
    >
      <div className="flex flex-col gap-4 px-5 py-5 md:px-7">
        <TraceHeader root={root} flow={flow} services={levels.services.length} />
        <PlotLineNote plot={buildPlotLine(flow, labelOf)} />
        <ServiceChips
          services={levels.services}
          current={level.service}
          onPick={(service) => pick(levels.levels[service.firstLevel].rootIndex)}
        />
      </div>
      <div className="grid grid-cols-1 border-t border-border lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0">
          <LevelBar
            path={path}
            level={level}
            durationMs={timeline.totalMs}
            errorPathOnly={errorPathOnly}
            onGoTo={goTo}
            onToggleErrorPath={toggleErrorPath}
          />
          {level.isEvent ? <EventNote level={level} caller={caller} /> : null}
          <div
            className={cn(
              ROW_GRID,
              "border-b border-border bg-muted/30 px-3 py-1.5 text-[11px] text-low-emphasis",
            )}
          >
            <span>Step · what {level.service} did</span>
            <div className="hidden min-w-0 border-r border-transparent md:block">
              <TimelineAxis duration={timeline.totalMs} />
            </div>
            <span className="text-right">Took</span>
          </div>
          <div ref={list} className="max-h-[640px] overflow-y-auto">
            {visible.map((i) => {
              const item = flow.steps[i];
              return (
                <div key={`${item.spanId}:${i}`} data-story-row>
                  <TraceStoryRow
                    ref={i === index ? selectedRow : undefined}
                    step={item}
                    number={level.steps.indexOf(i) + 1}
                    indent={item.depth - rootDepth}
                    title={narrations[i].title}
                    description={narrations[i].description}
                    timing={timingOf.get(i)!}
                    selected={i === index}
                    opens={(levels.opens.get(i) ?? []).map((id) => levels.levels[id])}
                    onSelect={() => pick(i)}
                    onOpen={(next) => pick(next.rootIndex)}
                  />
                </div>
              );
            })}
          </div>
          <Legend />
          <StoryNotes flow={flow} skewCount={timeline.timings.filter((t) => t.skewed).length} />
        </div>
        <div className="min-w-0 border-t border-border lg:border-l lg:border-t-0">
          <TraceStoryDetail
            step={step}
            service={level.service}
            number={position + 1}
            total={level.steps.length}
            from={labelOf(step.fromId)}
            to={labelOf(step.toId)}
            narration={narrations[index]}
            startOffsetMs={startOffsetMs}
            onSelectStep={pick}
          />
          <TraceStoryLogs
            step={step}
            service={level.service}
            parent={parentIndex >= 0 ? flow.steps[parentIndex] : undefined}
            originMs={model.originMs}
            requestId={requestId}
            stepOf={(spanId) => (spanId ? model.spanIndex.get(spanId) : undefined)}
            onSelectStep={pick}
          />
        </div>
      </div>
    </section>
  );
};

/** Mirrors the loaded layout so the page does not jump when the trace arrives. */
const TraceStorySkeleton = () => (
  <section
    aria-busy="true"
    aria-label="Loading the trace"
    className="overflow-hidden rounded-xl border border-border bg-card shadow-sm dark:bg-muted/40"
  >
    <div className="flex flex-col gap-4 px-5 py-5 md:px-7">
      <div className="flex items-start justify-between gap-6">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-5 w-10" />
            <Skeleton className="h-6 w-64" />
          </div>
          <Skeleton className="h-4 w-80" />
        </div>
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-6 w-10" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
      <Skeleton className="h-4 w-3/5" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3 w-14" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
    </div>
    <div className="grid grid-cols-1 border-t border-border lg:grid-cols-[minmax(0,1fr)_420px]">
      <div className="min-w-0">
        <div className="flex items-center gap-3 border-b border-border px-5 py-2.5">
          <Skeleton className="h-8 w-8" />
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="border-b border-border bg-muted/30 px-3 py-2">
          <Skeleton className="h-3 w-full" />
        </div>
        {[60, 20, 45, 30].map((bar, i) => (
          <div key={i} className={cn(ROW_GRID, "items-center border-b border-border px-3 py-3")}>
            <div className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
            <div className="hidden md:block">
              <Skeleton className="h-2.5" style={{ width: `${bar}%`, marginLeft: `${i * 12}%` }} />
            </div>
            <Skeleton className="ml-auto h-3 w-14" />
          </div>
        ))}
      </div>
      <div className="flex min-w-0 flex-col gap-3 border-t border-border px-5 py-5 lg:border-l lg:border-t-0">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="mt-2 h-10 w-full" />
      </div>
    </div>
  </section>
);

export const TraceStoryView = () => {
  const { traceHistory, isLoading } = useContext(timelineContext);
  const current = traceHistory.at(-1)?.current ?? null;
  const flow = useMemo(() => buildTraceFlow(current), [current]);
  if (isLoading || !current) return <TraceStorySkeleton />;
  if (!flow.steps.length) return <p className="text-sm">This trace has no recorded steps.</p>;
  return <TraceStory key={`${current.traceId}:${current.spanId}`} root={current} flow={flow} />;
};

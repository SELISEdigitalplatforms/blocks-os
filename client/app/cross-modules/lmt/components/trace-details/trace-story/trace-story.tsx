import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleAlert, CircleCheck, Pause, Play } from "lucide-react";
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
import { MAX_PINS, pinKey, TraceStoryPins, type StoryPin } from "./trace-story-pins";
import { ROW_GRID, TRAFFIC_BAR, TRAFFIC_LABEL, TraceStoryRow } from "./trace-story-row";
import {
  buildPlotLine,
  buildTimeline,
  getErrorPath,
  getParentIndexes,
  plural,
  type PlotLine,
} from "./trace-story.util";

/** How long the story rests on each step while it plays. */
export const PLAY_STEP_MS = 2000;

const shortId = (value?: string) => (value && value.length > 10 ? `${value.slice(0, 8)}…` : value);

const HeaderFact = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex min-w-0 flex-col">
    <span className="text-[10px] font-medium uppercase tracking-wider text-low-emphasis">
      {label}
    </span>
    <span className="truncate font-mono text-xs text-high-emphasis">{children}</span>
  </div>
);

const TraceHeader = ({ root, flow }: { root: TraceTree; flow: TraceFlow }) => {
  const status = getTraceStatus(root);
  const services = new Set(flow.steps.map((step) => step.serviceName).filter(Boolean)).size;
  const method = root.entryPoint?.method;
  const action = root.entryPoint?.actionName || flow.steps[0]?.tag;
  const tenant = root.securityContext?.TenantId || root.baggage?.TenantId;
  const user = root.securityContext?.UserId;
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 flex-[1_1_260px] flex-col">
        <p className="flex min-w-0 items-baseline gap-2 text-base font-semibold text-high-emphasis">
          {method ? <span className="text-xs uppercase text-medium-emphasis">{method}</span> : null}
          <span className="truncate" title={action}>
            {action}
          </span>
        </p>
        <span className="truncate text-xs text-medium-emphasis">{root.serviceName}</span>
      </div>
      <HeaderFact label="When">{formatDate(parseDateString(root.startTime))}</HeaderFact>
      <HeaderFact label="Took">{formatDurationMs(root.duration)}</HeaderFact>
      <HeaderFact label="Steps">
        {flow.totalSpans} · {plural(services, "service")}
      </HeaderFact>
      {tenant || user ? (
        <HeaderFact label="Who">
          <span
            title={[tenant && `Tenant ${tenant}`, user && `User ${user}`]
              .filter(Boolean)
              .join(" · ")}
          >
            {[tenant && `tenant ${shortId(tenant)}`, user && `user ${shortId(user)}`]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </HeaderFact>
      ) : null}
      <HeaderFact label="Trace ID">
        <CopyToClipboardButton textToCopy={root.traceId} label="Copy trace ID" isHoverable>
          <span>{shortId(root.traceId)}</span>
        </CopyToClipboardButton>
      </HeaderFact>
      <div className="flex flex-col">
        <span className="text-[10px] font-medium uppercase tracking-wider text-low-emphasis">
          Result
        </span>
        <Badge variant={status.variant} className="py-0 tabular-nums">
          {status.label}
        </Badge>
      </div>
    </div>
  );
};

const Legend = () => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2 text-[11px] text-medium-emphasis">
    {(Object.keys(TRAFFIC_BAR) as (keyof typeof TRAFFIC_BAR)[]).map((traffic) => (
      <span key={traffic} className="inline-flex items-center gap-1.5">
        <span className={cn("h-2 w-2 rounded-full", TRAFFIC_BAR[traffic])} aria-hidden />
        {TRAFFIC_LABEL[traffic]}
      </span>
    ))}
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-warning" aria-hidden />
      Warning
    </span>
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-error" aria-hidden />
      Failed
    </span>
  </div>
);

const PlotLineBar = ({ plot, onSelect }: { plot: PlotLine; onSelect: (index: number) => void }) => {
  const failed = plot.tone === "error";
  const target = plot.stepIndex;
  return (
    <div
      className={cn(
        "flex flex-wrap items-start gap-x-3 gap-y-1 border-b border-border px-4 py-3 text-sm",
        failed ? "bg-error/5" : "bg-success/10",
      )}
    >
      {failed ? (
        <CircleAlert size={16} className="mt-0.5 shrink-0 text-error" aria-hidden />
      ) : (
        <CircleCheck size={16} className="mt-0.5 shrink-0 text-success" aria-hidden />
      )}
      <p className="min-w-0 flex-1 break-words text-high-emphasis">
        <strong className={failed ? "text-error" : undefined}>{plot.headline}</strong> {plot.detail}
      </p>
      {target === null ? null : (
        <Button
          variant="link"
          size="sm"
          type="button"
          className="h-auto p-0"
          onClick={() => onSelect(target)}
        >
          Go to step {target + 1}
        </Button>
      )}
    </div>
  );
};

const StoryControls = ({
  position,
  count,
  playing,
  hasErrors,
  errorPathOnly,
  onMove,
  onTogglePlay,
  onToggleErrorPath,
}: {
  position: number;
  count: number;
  playing: boolean;
  hasErrors: boolean;
  errorPathOnly: boolean;
  onMove: (delta: number) => void;
  onTogglePlay: () => void;
  onToggleErrorPath: () => void;
}) => (
  <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
    <Button
      variant="outline"
      size="sm"
      type="button"
      aria-label="Previous step"
      disabled={position <= 0}
      onClick={() => onMove(-1)}
    >
      <ChevronLeft size={15} />
    </Button>
    <Button size="sm" type="button" onClick={onTogglePlay}>
      {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
      {playing ? "Pause story" : "Play story"}
    </Button>
    <Button
      variant="outline"
      size="sm"
      type="button"
      aria-label="Next step"
      disabled={position >= count - 1}
      onClick={() => onMove(1)}
    >
      <ChevronRight size={15} />
    </Button>
    {hasErrors ? (
      <Button
        variant="ghost"
        size="sm"
        type="button"
        aria-pressed={errorPathOnly}
        onClick={onToggleErrorPath}
      >
        {errorPathOnly ? "Show all steps" : "Show only the path to the error"}
      </Button>
    ) : null}
    <span className="ml-auto font-mono text-xs tabular-nums text-medium-emphasis">
      Step {position + 1} / {count}
    </span>
  </div>
);

const StoryNotes = ({ flow, skewCount }: { flow: TraceFlow; skewCount: number }) => {
  if (!flow.truncated && skewCount === 0) return null;
  return (
    <div className="flex flex-col gap-1 px-4 pb-3 text-xs text-medium-emphasis">
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
  const timeline = useMemo(() => buildTimeline(flow, parents), [flow, parents]);
  const errorPath = useMemo(() => getErrorPath(flow, parents), [flow, parents]);
  const narrations = useMemo(
    () =>
      flow.steps.map((step) =>
        describeTransfer(step, labels.get(step.fromId) ?? "", labels.get(step.toId) ?? ""),
      ),
    [flow, labels],
  );
  const serviceNames = useMemo(
    () => [...new Set(flow.steps.map((step) => step.serviceName).filter(Boolean))],
    [flow],
  );
  const spanIndex = useMemo(() => new Map(flow.steps.map((step) => [step.spanId, step])), [flow]);
  const labelOf = (id: string) => labels.get(id) ?? id;
  return { labelOf, parents, timeline, errorPath, narrations, serviceNames, spanIndex };
};

const TraceStory = ({ root, flow }: { root: TraceTree; flow: TraceFlow }) => {
  const { setSelectedTrace, requestId } = useContext(timelineContext);
  const model = useStoryModel(flow);
  const { labelOf, parents, timeline, errorPath, narrations } = model;

  const [index, setIndex] = useState(Math.max(flow.errorOriginIndex, 0));
  const [playing, setPlaying] = useState(false);
  const [errorPathOnly, setErrorPathOnly] = useState(false);
  const [pins, setPins] = useState<StoryPin[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const selectedRow = useRef<HTMLButtonElement>(null);

  const visible = useMemo(
    () => (errorPathOnly ? flow.steps.filter((s) => errorPath.has(s.index)) : flow.steps),
    [errorPathOnly, errorPath, flow],
  );
  const position = visible.findIndex((s) => s.index === index);
  const step = flow.steps[index];

  useEffect(() => {
    setSelectedTrace({ ...step.span });
  }, [step, setSelectedTrace]);

  useEffect(() => {
    if (!playing) return;
    const timer = globalThis.setTimeout(() => {
      const next = visible[position + 1];
      if (next) setIndex(next.index);
      else setPlaying(false);
    }, PLAY_STEP_MS);
    return () => globalThis.clearTimeout(timer);
  }, [playing, position, visible]);

  // Keep the selected row inside the list's own scroll area without scrolling the page.
  useEffect(() => {
    const row = selectedRow.current;
    const box = list.current;
    if (!row || !box || box.scrollHeight <= box.clientHeight) return;
    if (row.offsetTop < box.scrollTop) box.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
  }, [index]);

  const pick = (next: number) => {
    setPlaying(false);
    if (next >= 0 && next < flow.steps.length) setIndex(next);
  };
  const move = (delta: number) => {
    const target = visible[Math.min(Math.max(position + delta, 0), visible.length - 1)];
    if (target) pick(target.index);
  };
  const togglePlay = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    if (position === visible.length - 1 && visible[0]) setIndex(visible[0].index);
    setPlaying(true);
  };
  const toggleErrorPath = () => {
    const next = !errorPathOnly;
    setErrorPathOnly(next);
    if (next && !errorPath.has(index)) pick(Math.max(flow.errorOriginIndex, 0));
    else setPlaying(false);
  };
  const togglePin = (pin: StoryPin) =>
    setPins((current) => {
      const key = pinKey(pin);
      if (current.some((p) => pinKey(p) === key)) return current.filter((p) => pinKey(p) !== key);
      return current.length >= MAX_PINS ? current : [...current, pin];
    });

  const timing = timeline.timings[index];
  const startOffsetMs = timing.untimed ? null : Date.parse(step.startTime) - timeline.originMs;
  const parentIndex = parents[index];

  return (
    <section aria-label="Trace story" className="overflow-hidden rounded-md border border-border">
      <TraceHeader root={root} flow={flow} />
      <PlotLineBar plot={buildPlotLine(flow, labelOf)} onSelect={pick} />
      <StoryControls
        position={position}
        count={visible.length}
        playing={playing}
        hasErrors={flow.errorCount > 0}
        errorPathOnly={errorPathOnly}
        onMove={move}
        onTogglePlay={togglePlay}
        onToggleErrorPath={toggleErrorPath}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0">
          <div
            className={cn(
              ROW_GRID,
              "border-b border-border px-3 py-1.5 text-[11px] text-low-emphasis",
            )}
          >
            <span>Step · what happened</span>
            <div className="hidden min-w-0 border-r border-transparent md:block">
              <TimelineAxis duration={timeline.totalMs} />
            </div>
            <span className="text-right">Took</span>
          </div>
          <div ref={list} className="max-h-[640px] overflow-y-auto">
            {visible.map((item) => (
              <TraceStoryRow
                key={`${item.spanId}:${item.index}`}
                ref={item.index === index ? selectedRow : undefined}
                step={item}
                title={narrations[item.index].title}
                description={narrations[item.index].description}
                timing={timeline.timings[item.index]}
                selected={item.index === index}
                onSelect={() => pick(item.index)}
              />
            ))}
          </div>
          <Legend />
          <StoryNotes flow={flow} skewCount={timeline.timings.filter((t) => t.skewed).length} />
        </div>
        <div className="min-w-0 border-t border-border lg:border-l lg:border-t-0">
          <TraceStoryDetail
            step={step}
            total={flow.steps.length}
            from={labelOf(step.fromId)}
            to={labelOf(step.toId)}
            narration={narrations[index]}
            startOffsetMs={startOffsetMs}
            pins={pins}
            onTogglePin={togglePin}
            onSelectStep={pick}
            onOpenLogs={() => {
              setPlaying(false);
              setLogsOpen(true);
            }}
          />
        </div>
      </div>
      <TraceStoryPins pins={pins} onSelectStep={pick} onRemove={togglePin} />
      <TraceStoryLogs
        open={logsOpen}
        onOpenChange={setLogsOpen}
        step={step}
        parent={parentIndex >= 0 ? flow.steps[parentIndex] : undefined}
        serviceNames={model.serviceNames}
        requestId={requestId}
        stepOf={(spanId) => (spanId ? model.spanIndex.get(spanId) : undefined)}
        onSelectStep={pick}
      />
    </section>
  );
};

export const TraceStoryView = () => {
  const { traceHistory, isLoading } = useContext(timelineContext);
  const current = traceHistory.at(-1)?.current ?? null;
  const flow = useMemo(() => buildTraceFlow(current), [current]);
  if (isLoading || !current) return <Skeleton className="h-96 w-full" />;
  if (!flow.steps.length) return <p className="text-sm">This trace has no recorded steps.</p>;
  return <TraceStory key={`${current.traceId}:${current.spanId}`} root={current} flow={flow} />;
};

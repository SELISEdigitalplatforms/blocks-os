import { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Globe,
  Layers3,
  Mail,
  Pause,
  Play,
  RotateCcw,
  Server,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui-kits/button/button";
import { Skeleton } from "@/components/ui-kits/skeleton/skeleton";
import { buildTraceFlow, type FlowNode, type TraceFlow } from "@blocks-lmt/utils/trace-flow.util";
import { formatDurationMs } from "@blocks-lmt/utils";
import { timelineContext } from "../trace-details";
import { TraceFlowInspector } from "./trace-flow-inspector";
import { TraceFlowEvidence } from "./trace-flow-evidence";
import { describeTransfer } from "./trace-flow-story";
import type { TraceFlowScene } from "./trace-flow-scene";
import "./trace-flow.css";

const icons = {
  caller: Globe,
  service: Server,
  database: Database,
  cache: Zap,
  queue: Mail,
  external: Box,
};
const reducedMotion = () =>
  Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

const Actor = ({
  node,
  role,
  onInspect,
}: {
  node: FlowNode;
  role: string;
  onInspect: () => void;
}) => {
  const Icon = icons[node.kind];
  return (
    <button
      type="button"
      className={`tf-actor tf-actor-${node.kind}`}
      onClick={onInspect}
      aria-label={`Inspect ${node.label}`}
    >
      <span className="tf-actor-role">{role}</span>
      <span className="tf-island">
        <span className="tf-island-shadow" />
        <span className="tf-object">
          <Icon strokeWidth={1.25} />
        </span>
        <span className="tf-island-base" />
      </span>
      <strong title={node.label}>{node.label}</strong>
      <span className="tf-actor-kind">{node.kind === "caller" ? "Request source" : node.kind}</span>
    </button>
  );
};

const ExploreMap = ({
  flow,
  index,
  onSelect,
}: {
  flow: TraceFlow;
  index: number;
  onSelect: (index: number) => void;
}) => {
  const host = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TraceFlowScene | null>(null);
  const onSelectRef = useRef(onSelect);
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">("loading");
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  useEffect(() => {
    let disposed = false;
    let scene: TraceFlowScene | null = null;
    import("./trace-flow-scene")
      .then(({ createTraceFlowScene }) => {
        if (disposed || !host.current) return;
        try {
          scene = createTraceFlowScene(host.current, flow, {
            reducedMotion: reducedMotion(),
            onStepChange: () => {},
            onPlayingChange: () => {},
            onNodeSelect: (id) => {
              const step = flow.steps.find((s) => s.toId === id || s.fromId === id);
              if (step) onSelectRef.current(step.index);
            },
          });
          scene.pause();
          sceneRef.current = scene;
          setStatus("ready");
        } catch {
          setStatus("unsupported");
        }
      })
      .catch(() => {
        if (!disposed) setStatus("unsupported");
      });
    return () => {
      disposed = true;
      scene?.dispose();
      sceneRef.current = null;
    };
  }, [flow]);
  useEffect(() => {
    if (status === "ready") sceneRef.current?.seek(index, true);
  }, [index, status]);
  return (
    <div className="tf-map">
      <div ref={host} className="tf-map-host" data-testid="trace-flow-stage" />
      {status !== "ready" ? (
        <p className="tf-map-message">
          {status === "loading"
            ? "Opening the map…"
            : "The 3D map needs WebGL. The guided story is still available."}
        </p>
      ) : (
        <div className="tf-map-tools">
          <span>Drag to rotate · Select a component</span>
          <button type="button" onClick={() => sceneRef.current?.resetCamera()}>
            Reset view
          </button>
        </div>
      )}
    </div>
  );
};

const TraceStory = ({ flow }: { flow: TraceFlow }) => {
  const { setSelectedTrace, requestId } = useContext(timelineContext);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [details, setDetails] = useState(false);
  const [evidence, setEvidence] = useState(false);
  const [map, setMap] = useState(false);
  const [speed, setSpeed] = useState(1);
  const nodes = useMemo(() => new Map(flow.nodes.map((node) => [node.id, node])), [flow]);
  const step = flow.steps[index];
  const from = nodes.get(step.fromId)!;
  const to = nodes.get(step.toId)!;
  const story = describeTransfer(step, from.label, to.label);
  const selectedRow = useRef<HTMLButtonElement>(null);
  const chapterList = useRef<HTMLDivElement>(null);
  const jump = (next: number) => {
    setIndex(Math.max(0, Math.min(flow.steps.length - 1, next)));
    setPlaying(false);
    setEnded(false);
  };
  useEffect(() => {
    setSelectedTrace({ ...step.span });
  }, [step, setSelectedTrace]);
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (index < flow.steps.length - 1) setIndex(index + 1);
      else {
        setPlaying(false);
        setEnded(true);
      }
    }, 3200 / speed);
    return () => window.clearTimeout(timer);
  }, [playing, index, speed, flow.steps.length]);
  useEffect(() => {
    const row = selectedRow.current;
    const list = chapterList.current;
    if (!row || !list) return;
    if (list.scrollWidth > list.clientWidth) {
      if (row.offsetLeft < list.scrollLeft) list.scrollLeft = row.offsetLeft;
      else if (row.offsetLeft + row.offsetWidth > list.scrollLeft + list.clientWidth)
        list.scrollLeft = row.offsetLeft + row.offsetWidth - list.clientWidth;
    }
    if (row.offsetTop < list.scrollTop) list.scrollTop = row.offsetTop;
    else if (row.offsetTop + row.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = row.offsetTop + row.offsetHeight - list.clientHeight;
  }, [index]);
  const inspect = () => {
    setPlaying(false);
    setDetails(true);
  };
  const replay = () => {
    setIndex(0);
    setEnded(false);
    setPlaying(true);
  };
  const togglePlay = () => {
    if (ended) replay();
    else setPlaying(!playing);
  };

  return (
    <section className="tf-story" aria-label="Request story">
      <header className="tf-header">
        <div>
          <span className="tf-eyebrow">Every request has a story</span>
          <h3>
            The story of this request<span>.</span>
          </h3>
          <p>
            {flow.steps.length} recorded events, from the first request to the work that followed.
          </p>
        </div>
        <div className="tf-header-actions">
          <span className="tf-duration">
            {formatDurationMs(flow.steps[0].durationMs)}
            <small>recorded duration</small>
          </span>
          <Button
            variant="ghost"
            size="sm"
            type="button"
            className="tf-text-button"
            aria-pressed={map}
            onClick={() => {
              setMap(!map);
              setPlaying(false);
            }}
          >
            <Layers3 size={15} />
            {map ? "Back to story" : "Explore 3D"}
          </Button>
        </div>
      </header>
      <div className="tf-layout">
        <nav className="tf-chapters" aria-label="Story chapters">
          <div className="tf-chapter-heading">
            <span>The journey</span>
            <span>
              {String(index + 1).padStart(2, "0")} / {String(flow.steps.length).padStart(2, "0")}
            </span>
          </div>
          <div className="tf-chapter-list" ref={chapterList}>
            {flow.steps.map((item) => {
              const description = describeTransfer(
                item,
                nodes.get(item.fromId)!.label,
                nodes.get(item.toId)!.label,
              );
              return (
                <button
                  type="button"
                  key={item.index}
                  ref={item.index === index ? selectedRow : undefined}
                  className={`tf-chapter ${item.index === index ? "tf-chapter-active" : ""} ${item.state === "error" ? "tf-chapter-error" : ""}`}
                  aria-label={`Chapter ${item.index + 1}: ${description.title} ${nodes.get(item.toId)!.label}`}
                  aria-current={item.index === index ? "step" : undefined}
                  onClick={() => jump(item.index)}
                >
                  <span className="tf-chapter-number">
                    {item.index < index && item.state !== "error" ? (
                      <Check size={12} />
                    ) : (
                      String(item.index + 1).padStart(2, "0")
                    )}
                  </span>
                  <span>
                    <strong>{description.title}</strong>
                    <small>{nodes.get(item.toId)!.label}</small>
                  </span>
                </button>
              );
            })}
          </div>
          {flow.errorOriginIndex >= 0 ? (
            <button
              type="button"
              className="tf-error-jump"
              onClick={() => jump(flow.errorOriginIndex)}
            >
              An error was recorded <ArrowUpRight size={13} />
            </button>
          ) : (
            <p className="tf-no-errors">
              <span /> No errors recorded
            </p>
          )}
        </nav>
        <div className="tf-main">
          {map ? (
            <ExploreMap flow={flow} index={index} onSelect={jump} />
          ) : (
            <div
              className={`tf-stage ${playing ? "tf-running" : ""} ${step.state === "error" ? "tf-stage-error" : ""}`}
            >
              <div className="tf-stage-top">
                <span>
                  <span className="tf-live-dot" />
                  {ended ? "Journey complete" : `Chapter ${String(index + 1).padStart(2, "0")}`}
                </span>
                <span>
                  {step.traffic === "data"
                    ? "Database operation"
                    : step.traffic === "cache"
                      ? "Cache operation"
                      : step.traffic === "message"
                        ? "Message transfer"
                        : step.fromId === step.toId
                          ? "Within a service"
                          : "Request transfer"}
                </span>
              </div>
              <div
                className={`tf-illustration ${step.fromId === step.toId ? "tf-internal" : ""}`}
                key={`${step.spanId}-${index}`}
              >
                {step.fromId !== step.toId ? (
                  <svg
                    className="tf-path"
                    viewBox="0 0 800 270"
                    preserveAspectRatio="none"
                    aria-hidden="true"
                  >
                    <path
                      className="tf-path-base"
                      d="M 175 145 C 300 145 300 145 400 145 S 535 145 625 145"
                    />
                    <path
                      className="tf-path-active"
                      d="M 175 145 C 300 145 300 145 400 145 S 535 145 625 145"
                    />
                    {playing && !reducedMotion() ? (
                      <circle r="4" fill="hsl(var(--primary))">
                        <animateMotion
                          dur="2.3s"
                          repeatCount="indefinite"
                          path="M 175 145 C 300 145 300 145 400 145 S 535 145 625 145"
                        />
                      </circle>
                    ) : null}
                  </svg>
                ) : null}
                {step.fromId !== step.toId ? (
                  <Actor node={from} role="From" onInspect={inspect} />
                ) : null}
                {step.fromId !== step.toId ? (
                  <div className="tf-transfer">
                    <span className="tf-transfer-type">
                      {step.traffic === "data"
                        ? "DATA"
                        : step.traffic === "cache"
                          ? "CACHE"
                          : step.traffic === "message"
                            ? "MESSAGE"
                            : "REQUEST"}
                    </span>
                    <button
                      type="button"
                      className="tf-packet"
                      onClick={inspect}
                      aria-label="Inspect transfer"
                    >
                      <Box size={23} strokeWidth={1.25} />
                      <ArrowRight size={14} />
                    </button>
                    <span className="tf-transfer-duration">
                      {formatDurationMs(step.durationMs)}
                    </span>
                  </div>
                ) : null}
                <Actor
                  node={to}
                  role={step.fromId === step.toId ? "Working in" : "To"}
                  onInspect={inspect}
                />
              </div>
              <div className="tf-scene-note">
                <span className="tf-recorded-dot" />
                {step.tag}
                <span className={`tf-outcome tf-outcome-${step.state}`}>{step.statusLabel}</span>
              </div>
            </div>
          )}
          <div
            className="tf-caption"
            key={`caption-${step.spanId}-${ended}`}
            aria-live={playing ? "off" : "polite"}
          >
            <span className="tf-eyebrow">
              {ended ? "The final frame" : `Moment ${String(index + 1).padStart(2, "0")}`}
            </span>
            <h4>{ended ? "The journey, complete." : story.title}</h4>
            <p>
              {ended
                ? `You’ve followed ${flow.steps.length} recorded events across ${flow.nodes.length} components. ${flow.errorCount ? `${flow.errorCount} spans reported a failure.` : "No errors were recorded."}`
                : story.description}
            </p>
            {step.errorMessage && !ended ? (
              <p className="tf-error-copy" role="alert">
                {step.errorMessage}
              </p>
            ) : null}
            {!ended ? (
              <div className={`tf-event-result tf-event-result-${step.state}`}>
                <div>
                  <span className="tf-result-label">Recorded result</span>
                  <p>{story.outcome}</p>
                  <small>
                    Trace status · {step.statusLabel} · {formatDurationMs(step.durationMs)}
                  </small>
                </div>
                {story.facts.length ? (
                  <dl>
                    {story.facts.map((fact) => (
                      <div key={fact.label}>
                        <dt>{fact.label}</dt>
                        <dd>{fact.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : null}
              </div>
            ) : null}
            <div className="tf-proof-actions">
              <Button
                variant="link"
                size="sm"
                type="button"
                className="tf-evidence-button"
                aria-expanded={evidence}
                onClick={() => {
                  setEvidence(!evidence);
                  setPlaying(false);
                }}
              >
                {evidence ? "Hide evidence" : "View evidence"}
                <ArrowUpRight size={13} />
              </Button>
              <span>Logs are the evidence behind this moment.</span>
              <Button
                variant="ghost"
                size="sm"
                type="button"
                className="tf-text-button"
                onClick={() => {
                  setDetails(!details);
                  setPlaying(false);
                }}
                aria-expanded={details}
              >
                {details ? "Hide details" : "View this moment"}
                <ArrowUpRight size={14} />
              </Button>
            </div>
          </div>
          {evidence ? (
            <div className="tf-evidence-panel">
              <div className="tf-evidence-title">
                <span>Evidence for this moment</span>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  aria-label="Close evidence"
                  onClick={() => setEvidence(false)}
                >
                  <X size={15} />
                </Button>
              </div>
              <TraceFlowEvidence
                key={`${step.span.traceId}:${step.spanId}:${step.serviceName}:${requestId ?? ""}`}
                step={step}
                requestId={requestId}
              />
            </div>
          ) : null}
        </div>
      </div>
      <footer className="tf-controls">
        <div className="tf-transport">
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Previous moment"
            disabled={index === 0 && !ended}
            onClick={() => jump(index - 1)}
          >
            <ChevronLeft size={18} />
          </Button>
          <Button size="sm" type="button" className="tf-play" onClick={togglePlay}>
            {playing ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
            {playing ? "Pause story" : ended ? "Replay story" : "Play story"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            type="button"
            aria-label="Next moment"
            disabled={index === flow.steps.length - 1}
            onClick={() => jump(index + 1)}
          >
            <ChevronRight size={18} />
          </Button>
        </div>
        <label className="tf-scrubber">
          <span className="sr-only">Story position</span>
          <input
            type="range"
            aria-label="Story position"
            min={0}
            max={flow.steps.length - 1}
            value={index}
            onChange={(e) => jump(Number(e.target.value))}
          />
          <span>
            {index + 1} / {flow.steps.length}
          </span>
        </label>
        <label className="tf-speed">
          <span className="sr-only">Story speed</span>
          <select
            aria-label="Story speed"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            {[0.5, 1, 1.5, 2].map((value) => (
              <option key={value} value={value}>
                {value}×
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="tf-restart"
          onClick={replay}
          aria-label="Restart story"
        >
          <RotateCcw size={15} />
        </Button>
      </footer>
      {details ? (
        <div className="tf-details">
          <div className="tf-details-heading">
            <span>Behind this moment</span>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label="Close details"
              onClick={() => setDetails(false)}
            >
              <X size={16} />
            </Button>
          </div>
          <TraceFlowInspector step={step} from={from.label} to={to.label} />
          <p>
            Events are ordered by start time; work can overlap. Animation speed is illustrative.
          </p>
        </div>
      ) : null}
      {flow.truncated ? (
        <p className="tf-footnote">
          Showing {flow.steps.length} of {flow.totalSpans} spans, including failing spans and their
          ancestors.
        </p>
      ) : null}
    </section>
  );
};

export const TraceFlowView = () => {
  const { traceHistory, isLoading } = useContext(timelineContext);
  const current = traceHistory[traceHistory.length - 1]?.current ?? null;
  const flow = useMemo(() => buildTraceFlow(current), [current]);
  if (isLoading || !current) return <Skeleton className="h-96 w-full" />;
  if (!flow.steps.length) return <p>This trace has no recorded events.</p>;
  return <TraceStory key={`${current.traceId}:${current.spanId}`} flow={flow} />;
};

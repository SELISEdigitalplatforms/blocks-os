import { useContext, useEffect, useMemo, useRef, useState, type RefObject } from "react";
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
import {
  buildTraceFlow,
  type FlowNode,
  type FlowStep,
  type TraceFlow,
} from "@blocks-lmt/utils/trace-flow.util";
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
  Boolean(globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

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
    const selectNode = (id: string) => {
      const step = findNodeStep(flow, id);
      if (step) onSelectRef.current(step.index);
    };
    const initialize = async () => {
      try {
        const { createTraceFlowScene } = await import("./trace-flow-scene");
        const element = host.current;
        if (disposed || !element) return;
        scene = createTraceFlowScene(element, flow, {
          reducedMotion: reducedMotion(),
          onStepChange: ignoreSceneChange,
          onPlayingChange: ignoreSceneChange,
          onNodeSelect: selectNode,
        });
        scene.pause();
        sceneRef.current = scene;
        setStatus("ready");
      } catch {
        if (!disposed) setStatus("unsupported");
      }
    };
    void initialize();
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
      <MapOverlay status={status} onReset={() => sceneRef.current?.resetCamera()} />
    </div>
  );
};

type MomentProps = {
  step: FlowStep;
  from: FlowNode;
  to: FlowNode;
  playing: boolean;
  inspect: () => void;
};
type PlaybackProps = { flow: TraceFlow; index: number; playing: boolean; ended: boolean };
type StoryDescription = ReturnType<typeof describeTransfer>;

const ignoreSceneChange = () => {};
const findNodeStep = (flow: TraceFlow, id: string) =>
  flow.steps.find((step) => step.toId === id || step.fromId === id);

const MapOverlay = ({
  status,
  onReset,
}: {
  status: "loading" | "ready" | "unsupported";
  onReset: () => void;
}) => {
  if (status === "ready")
    return (
      <div className="tf-map-tools">
        <span>Drag to rotate · Select a component</span>
        <button type="button" onClick={onReset}>
          Reset view
        </button>
      </div>
    );
  const message =
    status === "loading"
      ? "Opening the map…"
      : "The 3D map needs WebGL. The guided story is still available.";
  return <p className="tf-map-message">{message}</p>;
};

const stageLabel = (step: FlowStep) => {
  const labels = {
    data: "Database operation",
    cache: "Cache operation",
    message: "Message transfer",
  };
  if (step.traffic in labels) return labels[step.traffic as keyof typeof labels];
  if (step.fromId === step.toId) return "Within a service";
  return "Request transfer";
};

const packetLabels: Record<FlowStep["traffic"], string> = {
  data: "DATA",
  cache: "CACHE",
  message: "MESSAGE",
  http: "REQUEST",
  call: "REQUEST",
};

const completedDescription = (flow: TraceFlow) => {
  const outcome = flow.errorCount
    ? `${flow.errorCount} spans reported a failure.`
    : "No errors were recorded.";
  return `You’ve followed ${flow.steps.length} recorded events across ${flow.nodes.length} components. ${outcome}`;
};

const playLabel = (playing: boolean, ended: boolean) => {
  if (playing) return "Pause story";
  if (ended) return "Replay story";
  return "Play story";
};

const StoryHeader = ({
  flow,
  map,
  onToggleMap,
}: {
  flow: TraceFlow;
  map: boolean;
  onToggleMap: () => void;
}) => (
  <header className="tf-header">
    <div>
      <span className="tf-eyebrow">Every request has a story</span>
      <h3>
        The story of this request<span>.</span>
      </h3>
      <p>{flow.steps.length} recorded events, from the first request to the work that followed.</p>
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
        onClick={onToggleMap}
      >
        <Layers3 size={15} />
        {map ? "Back to story" : "Explore 3D"}
      </Button>
    </div>
  </header>
);

const StoryNavigation = ({
  flow,
  index,
  nodes,
  jump,
  selectedRow,
  chapterList,
}: {
  flow: TraceFlow;
  index: number;
  nodes: Map<string, FlowNode>;
  jump: (index: number) => void;
  selectedRow: RefObject<HTMLButtonElement | null>;
  chapterList: RefObject<HTMLDivElement | null>;
}) => (
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
      <button type="button" className="tf-error-jump" onClick={() => jump(flow.errorOriginIndex)}>
        An error was recorded <ArrowUpRight size={13} />
      </button>
    ) : (
      <p className="tf-no-errors">
        <span /> No errors recorded
      </p>
    )}
  </nav>
);

const TransferIllustration = ({ step, from, to, playing, inspect }: MomentProps) => {
  const index = step.index;
  const internal = step.fromId === step.toId;
  return (
    <div
      className={`tf-illustration ${step.fromId === step.toId ? "tf-internal" : ""}`}
      key={`${step.spanId}-${index}`}
    >
      {internal ? null : (
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
      )}
      {internal ? null : <Actor node={from} role="From" onInspect={inspect} />}
      {internal ? null : (
        <div className="tf-transfer">
          <span className="tf-transfer-type">{packetLabels[step.traffic]}</span>
          <button
            type="button"
            className="tf-packet"
            onClick={inspect}
            aria-label="Inspect transfer"
          >
            <Box size={23} strokeWidth={1.25} />
            <ArrowRight size={14} />
          </button>
          <span className="tf-transfer-duration">{formatDurationMs(step.durationMs)}</span>
        </div>
      )}
      <Actor node={to} role={step.fromId === step.toId ? "Working in" : "To"} onInspect={inspect} />
    </div>
  );
};

const StoryMoment = ({
  step,
  from,
  to,
  index,
  ended,
  playing,
  inspect,
}: MomentProps & { index: number; ended: boolean }) => (
  <div
    className={`tf-stage ${playing ? "tf-running" : ""} ${step.state === "error" ? "tf-stage-error" : ""}`}
  >
    <div className="tf-stage-top">
      <span>
        <span className="tf-live-dot" />
        {ended ? "Journey complete" : `Chapter ${String(index + 1).padStart(2, "0")}`}
      </span>
      <span>{stageLabel(step)}</span>
    </div>
    <TransferIllustration step={step} from={from} to={to} playing={playing} inspect={inspect} />
    <div className="tf-scene-note">
      <span className="tf-recorded-dot" />
      {step.tag}
      <span className={`tf-outcome tf-outcome-${step.state}`}>{step.statusLabel}</span>
    </div>
  </div>
);

const StoryResult = ({ step, story }: { step: FlowStep; story: StoryDescription }) => (
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
);

const StoryCaption = ({
  flow,
  step,
  story,
  index,
  ended,
  playing,
  details,
  evidence,
  onToggleEvidence,
  onToggleDetails,
}: PlaybackProps & {
  step: FlowStep;
  story: StoryDescription;
  details: boolean;
  evidence: boolean;
  onToggleEvidence: () => void;
  onToggleDetails: () => void;
}) => (
  <div
    className="tf-caption"
    key={`caption-${step.spanId}-${ended}`}
    aria-live={playing ? "off" : "polite"}
  >
    <span className="tf-eyebrow">
      {ended ? "The final frame" : `Moment ${String(index + 1).padStart(2, "0")}`}
    </span>
    <h4>{ended ? "The journey, complete." : story.title}</h4>
    <p>{ended ? completedDescription(flow) : story.description}</p>
    {step.errorMessage && !ended ? (
      <p className="tf-error-copy" role="alert">
        {step.errorMessage}
      </p>
    ) : null}
    {ended ? null : <StoryResult step={step} story={story} />}
    <div className="tf-proof-actions">
      <Button
        variant="link"
        size="sm"
        type="button"
        className="tf-evidence-button"
        aria-expanded={evidence}
        onClick={onToggleEvidence}
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
        onClick={onToggleDetails}
        aria-expanded={details}
      >
        {details ? "Hide details" : "View this moment"}
        <ArrowUpRight size={14} />
      </Button>
    </div>
  </div>
);

const EvidencePanel = ({
  step,
  requestId,
  onClose,
}: {
  step: FlowStep;
  requestId?: string;
  onClose: () => void;
}) => (
  <div className="tf-evidence-panel">
    <div className="tf-evidence-title">
      <span>Evidence for this moment</span>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="Close evidence"
        onClick={onClose}
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
);

const StoryControls = ({
  flow,
  index,
  playing,
  ended,
  speed,
  setSpeed,
  jump,
  togglePlay,
  replay,
}: PlaybackProps & {
  speed: number;
  setSpeed: (speed: number) => void;
  jump: (index: number) => void;
  togglePlay: () => void;
  replay: () => void;
}) => (
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
        {playLabel(playing, ended)}
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
);

const StoryDetails = ({
  step,
  from,
  to,
  onClose,
}: {
  step: FlowStep;
  from: FlowNode;
  to: FlowNode;
  onClose: () => void;
}) => (
  <div className="tf-details">
    <div className="tf-details-heading">
      <span>Behind this moment</span>
      <Button
        variant="ghost"
        size="icon"
        type="button"
        aria-label="Close details"
        onClick={onClose}
      >
        <X size={16} />
      </Button>
    </div>
    <TraceFlowInspector step={step} from={from.label} to={to.label} />
    <p>Events are ordered by start time; work can overlap. Animation speed is illustrative.</p>
  </div>
);

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
    const timer = globalThis.setTimeout(() => {
      if (index < flow.steps.length - 1) setIndex(index + 1);
      else {
        setPlaying(false);
        setEnded(true);
      }
    }, 3200 / speed);
    return () => globalThis.clearTimeout(timer);
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

  const toggleMap = () => {
    setMap(!map);
    setPlaying(false);
  };
  const toggleEvidence = () => {
    setEvidence(!evidence);
    setPlaying(false);
  };
  const toggleDetails = () => {
    setDetails(!details);
    setPlaying(false);
  };
  return (
    <section className="tf-story" aria-label="Request story">
      <StoryHeader flow={flow} map={map} onToggleMap={toggleMap} />
      <div className="tf-layout">
        <StoryNavigation
          flow={flow}
          index={index}
          nodes={nodes}
          jump={jump}
          selectedRow={selectedRow}
          chapterList={chapterList}
        />
        <div className="tf-main">
          {map ? (
            <ExploreMap flow={flow} index={index} onSelect={jump} />
          ) : (
            <StoryMoment
              step={step}
              from={from}
              to={to}
              index={index}
              ended={ended}
              playing={playing}
              inspect={inspect}
            />
          )}
          <StoryCaption
            flow={flow}
            step={step}
            story={story}
            index={index}
            ended={ended}
            playing={playing}
            details={details}
            evidence={evidence}
            onToggleEvidence={toggleEvidence}
            onToggleDetails={toggleDetails}
          />
          {evidence ? (
            <EvidencePanel step={step} requestId={requestId} onClose={() => setEvidence(false)} />
          ) : null}
        </div>
      </div>
      <StoryControls
        flow={flow}
        index={index}
        playing={playing}
        ended={ended}
        speed={speed}
        setSpeed={setSpeed}
        jump={jump}
        togglePlay={togglePlay}
        replay={replay}
      />
      {details ? (
        <StoryDetails step={step} from={from} to={to} onClose={() => setDetails(false)} />
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
  const current = traceHistory.at(-1)?.current ?? null;
  const flow = useMemo(() => buildTraceFlow(current), [current]);
  if (isLoading || !current) return <Skeleton className="h-96 w-full" />;
  if (!flow.steps.length) return <p>This trace has no recorded events.</p>;
  return <TraceStory key={`${current.traceId}:${current.spanId}`} flow={flow} />;
};

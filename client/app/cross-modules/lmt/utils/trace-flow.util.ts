import { getTraceStatus, type IAttributes, type TraceTree } from "../models/trace.model";

/**
 * Turns a trace tree into a "flow": the components a request touched and one step per span,
 * in the order the spans ran. The 3D flow view plays these steps; nothing here knows about
 * rendering, so every rule about what a span *means* lives in this file and is unit-tested.
 */

export type FlowNodeKind = "caller" | "service" | "database" | "cache" | "queue" | "external";
export type FlowTraffic = "http" | "data" | "cache" | "message" | "call";
export type FlowStepState = "ok" | "warning" | "error" | "unknown";

export interface FlowNode {
  id: string;
  label: string;
  kind: FlowNodeKind;
  /** A step that failed ended at this node. */
  hasError: boolean;
  /** The step where the error started ended at this node. */
  isErrorOrigin: boolean;
}

export interface FlowStep {
  index: number;
  spanId: string;
  fromId: string;
  toId: string;
  traffic: FlowTraffic;
  /** Short label for what travelled: "GET /api/users", "MongoDB find", "publish OrderPlaced". */
  tag: string;
  operationName: string;
  serviceName: string;
  durationMs: number;
  startTime: string;
  depth: number;
  state: FlowStepState;
  statusLabel: string;
  errorMessage: string | null;
  /** Failed, and nothing it called failed: this is where the error happened. */
  isErrorOrigin: boolean;
  /** Failed only because a span it called failed. */
  isPropagatedError: boolean;
  /** Index of the origin step this failure came from, when it is propagated. */
  causedByIndex: number | null;
  span: TraceTree;
}

export interface TraceFlow {
  nodes: FlowNode[];
  steps: FlowStep[];
  /** First step where an error started, or -1 when nothing failed. */
  errorOriginIndex: number;
  errorCount: number;
  /** Spans in the trace, before any cap was applied. */
  totalSpans: number;
  truncated: boolean;
}

/** More steps than this would take minutes to play and would crowd the scene. Failing spans
 *  and their ancestors are always kept, so a capped flow still shows where it broke. */
export const MAX_FLOW_STEPS = 300;

const CALLER_ID = "caller";

const text = (attributes: IAttributes | undefined, ...keys: string[]): string => {
  for (const key of keys) {
    const value = attributes?.[key] ?? "";
    const str = String(value).trim();
    if (str) return str;
  }
  return "";
};

const stringValue = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  return "";
};

const isTruthyFlag = (value: unknown) =>
  value === true || value === 1 || /^(true|1)$/i.test(stringValue(value));

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
};

const pathOf = (url: string) => {
  try {
    return new URL(url).pathname;
  } catch {
    return "";
  }
};

const timeOf = (value: string | undefined) => {
  const ms = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

interface Component {
  id: string;
  label: string;
  kind: FlowNodeKind;
  traffic: FlowTraffic;
  tag: string;
  /** Where this span's step comes from when it is not its parent's component. */
  fromOverride?: { id: string; label: string; kind: FlowNodeKind };
}

const serviceComponent = (span: TraceTree) => {
  const name = span.serviceName?.trim() || "Unknown service";
  return { id: `svc:${name}`, label: name, kind: "service" as const };
};

const clientComponent = (span: TraceTree, op: string): Component => {
  const attrs = span.attributes;
  const url = text(attrs, "url.full", "http.url");
  const host = text(attrs, "server.address") || hostOf(url);
  const method = text(attrs, "http.request.method", "http.method", "method");
  if (host || url || method || /http/i.test(op)) {
    const label = host || "External HTTP";
    const path = pathOf(url);
    const tag = [method || "HTTP", path].filter(Boolean).join(" ");
    return { id: `ext:${label}`, label, kind: "external", traffic: "http", tag };
  }
  if (/grpc/i.test(op)) {
    return {
      id: "ext:grpc",
      label: "gRPC service",
      kind: "external",
      traffic: "http",
      tag: "gRPC call",
    };
  }

  const label = span.activitySourceName?.trim() || op;
  return { id: `ext:${label}`, label, kind: "external", traffic: "call", tag: op };
};

/** Decides which component a span ran in and what kind of traffic reached it. */
export const classifySpan = (span: TraceTree): Component => {
  const op = span.operationName?.trim() || span.activitySourceName?.trim() || "span";
  const kind = span.kind?.trim().toLowerCase() ?? "";
  const attrs = span.attributes;

  const mongo = /^MongoDb::(.+)$/i.exec(op);
  if (mongo) {
    return {
      id: "db:mongodb",
      label: "MongoDB",
      kind: "database",
      traffic: "data",
      tag: `MongoDB ${mongo[1]}`,
    };
  }

  const redis = /^Redis::(.+)$/i.exec(op);
  if (redis) {
    if (kind === "consumer") {
      return {
        ...serviceComponent(span),
        traffic: "cache",
        tag: `Redis ${redis[1]}`,
        fromOverride: { id: "cache:redis", label: "Redis", kind: "cache" },
      };
    }
    return {
      id: "cache:redis",
      label: "Redis",
      kind: "cache",
      traffic: "cache",
      tag: `Redis ${redis[1]}`,
    };
  }

  const messagingSystem = text(attrs, "messaging.system");
  const isMessaging = Boolean(messagingSystem) || /messaging|servicebus|rabbitmq/i.test(op);
  if (isMessaging && (kind === "producer" || kind === "consumer")) {
    const destination = text(attrs, "messaging.destination.name", "messaging.destination");
    const queue = {
      id: `queue:${destination || messagingSystem || "broker"}`,
      label: destination || messagingSystem || "Message broker",
      kind: "queue" as const,
    };
    if (kind === "producer") {
      const messageType = text(attrs, "messaging.message_type");
      return {
        ...queue,
        traffic: "message",
        tag: `publish ${messageType || destination || "message"}`,
      };
    }
    return {
      ...serviceComponent(span),
      traffic: "message",
      tag: `consume ${destination || "message"}`,
      fromOverride: queue,
    };
  }

  if (kind === "client") return clientComponent(span, op);

  if (kind === "producer") {
    const label = span.activitySourceName?.trim() || op;
    return { id: `ext:${label}`, label, kind: "external", traffic: "call", tag: op };
  }

  return {
    ...serviceComponent(span),
    traffic: kind === "server" ? "http" : "call",
    tag: op,
  };
};

/** Whether a span failed, and the message that explains why. */
export const getSpanOutcome = (span: TraceTree) => {
  const status = getTraceStatus(span);
  const attrs = span.attributes ?? {};
  const errorAttr = attrs.error;
  const errorText = stringValue(errorAttr);
  const hasErrorText = errorText !== "" && !/^false$/i.test(errorText);
  const failed =
    status.variant === "error" ||
    span.status === "Error" ||
    isTruthyFlag(attrs.Error) ||
    isTruthyFlag(errorAttr) ||
    hasErrorText;

  let state: FlowStepState;
  if (failed) state = "error";
  else if (status.variant === "warning") state = "warning";
  else if (status.variant === "success") state = "ok";
  else state = "unknown";

  let errorMessage: string | null = null;
  if (state === "error" || state === "warning") {
    const description = span.status === "Error" ? span.statusDescription?.trim() : "";
    errorMessage =
      description ||
      text(attrs, "errorMessage", "exception.message", "error.message") ||
      (hasErrorText ? errorText : "") ||
      (/^\d{3}$/.test(status.label) ? `HTTP ${status.label}` : "The span reported an error");
  }

  return {
    state,
    statusLabel: state === "error" && status.variant !== "error" ? "Error" : status.label,
    errorMessage,
  };
};

interface Visit {
  span: TraceTree;
  depth: number;
  parentIndex: number;
}

/** Depth-first, children in start order, so a parent always plays before what it called even
 *  when clocks on different hosts disagree. Spans seen twice, and cycles, are skipped. */
const walk = (root: TraceTree): Visit[] => {
  const out: Visit[] = [];
  const seen = new Set<string>();
  const stack: Visit[] = [{ span: root, depth: 0, parentIndex: -1 }];
  while (stack.length) {
    const visit = stack.pop()!;
    const key = visit.span.spanId || `#${out.length}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const index = out.length;
    out.push(visit);
    const children = (visit.span.subEntries ?? [])
      .map((span, order) => ({ span, order }))
      .sort((a, b) => timeOf(a.span.startTime) - timeOf(b.span.startTime) || a.order - b.order);
    for (let i = children.length - 1; i >= 0; i--) {
      stack.push({ span: children[i].span, depth: visit.depth + 1, parentIndex: index });
    }
  }
  return out;
};

const findErrorOrigins = (visits: Visit[], outcomes: ReturnType<typeof getSpanOutcome>[]) => {
  // A failing span whose descendants all succeeded is where the error started. Visits are in
  // pre-order, so walking backwards sees every child before its parent.
  const errorBelow = new Array<number>(visits.length).fill(-1);
  const originOf = new Array<number>(visits.length).fill(-1);
  for (let i = visits.length - 1; i >= 0; i--) {
    const failed = outcomes[i].state === "error";
    if (failed) originOf[i] = errorBelow[i] >= 0 ? errorBelow[i] : i;
    const parent = visits[i].parentIndex;
    if (parent >= 0) {
      const carried = failed ? originOf[i] : errorBelow[i];
      if (carried >= 0 && (errorBelow[parent] < 0 || carried < errorBelow[parent]))
        errorBelow[parent] = carried;
    }
  }

  return originOf;
};

export const buildTraceFlow = (
  root: TraceTree | null | undefined,
  maxSteps = MAX_FLOW_STEPS,
): TraceFlow => {
  const empty: TraceFlow = {
    nodes: [],
    steps: [],
    errorOriginIndex: -1,
    errorCount: 0,
    totalSpans: 0,
    truncated: false,
  };
  if (!root) return empty;

  const visits = walk(root);
  const components = visits.map((v) => classifySpan(v.span));
  const outcomes = visits.map((v) => getSpanOutcome(v.span));

  const originOf = findErrorOrigins(visits, outcomes);

  // Cap long traces, but never drop a failing span or the path that leads to it.
  let keep = visits.map((_, i) => i);
  let truncated = false;
  if (visits.length > maxSteps) {
    truncated = true;
    const required = new Set<number>();
    visits.forEach((_, i) => {
      if (outcomes[i].state !== "error") return;
      for (let j = i; j >= 0 && !required.has(j); j = visits[j].parentIndex) required.add(j);
    });
    let budget = Math.max(0, maxSteps - required.size);
    keep = keep.filter((i) => {
      if (required.has(i)) return true;
      if (budget > 0) {
        budget--;
        return true;
      }
      return false;
    });
  }

  const nodes = new Map<string, FlowNode>();
  const addNode = (id: string, label: string, kind: FlowNodeKind) => {
    if (!nodes.has(id)) nodes.set(id, { id, label, kind, hasError: false, isErrorOrigin: false });
    return nodes.get(id)!;
  };

  const stepIndexOfVisit = new Map<number, number>();
  const steps: FlowStep[] = [];
  keep.forEach((vi) => {
    const { span, depth, parentIndex } = visits[vi];
    const component = components[vi];
    const outcome = outcomes[vi];

    let from: { id: string; label: string; kind: FlowNodeKind };
    if (component.fromOverride) from = component.fromOverride;
    else if (parentIndex >= 0) {
      const parent = components[parentIndex];
      from = { id: parent.id, label: parent.label, kind: parent.kind };
    } else if (span.kind?.trim().toLowerCase() === "server")
      from = { id: CALLER_ID, label: "Caller", kind: "caller" };
    else from = component;

    addNode(from.id, from.label, from.kind);
    const to = addNode(component.id, component.label, component.kind);

    const failed = outcome.state === "error";
    const isOrigin = failed && originOf[vi] === vi;
    if (failed) to.hasError = true;
    if (isOrigin) to.isErrorOrigin = true;

    stepIndexOfVisit.set(vi, steps.length);
    steps.push({
      index: steps.length,
      spanId: span.spanId,
      fromId: from.id,
      toId: component.id,
      traffic: component.traffic,
      tag: component.tag,
      operationName: span.operationName ?? "",
      serviceName: span.serviceName ?? "",
      durationMs: Number.isFinite(span.duration) ? span.duration : 0,
      startTime: span.startTime ?? "",
      depth,
      state: outcome.state,
      statusLabel: outcome.statusLabel,
      errorMessage: outcome.errorMessage,
      isErrorOrigin: isOrigin,
      isPropagatedError: failed && !isOrigin,
      causedByIndex: null,
      span,
    });
  });

  steps.forEach((step, i) => {
    if (!step.isPropagatedError) return;
    const origin = originOf[keep[i]];
    step.causedByIndex = stepIndexOfVisit.get(origin) ?? null;
  });

  return {
    nodes: [...nodes.values()],
    steps,
    errorOriginIndex: steps.findIndex((s) => s.isErrorOrigin),
    errorCount: steps.filter((s) => s.state === "error").length,
    totalSpans: visits.length,
    truncated,
  };
};

import type {
  Trace,
  TraceTree,
  ITags,
  ISecurityContext,
  IRequest,
  IResponse,
} from "../models/trace.model";

const ZERO_PARENT_SPAN_ID = "0000000000000000";

export const isRootSpan = (
  item: Pick<Trace, "parentId" | "parentSpanId">,
): boolean => {
  const parentSpanId = item.parentSpanId?.trim() ?? "";
  if (!parentSpanId || parentSpanId === ZERO_PARENT_SPAN_ID) {
    return true;
  }

  return !item.parentId?.trim();
};

export const getParentSpanKey = (
  item: Pick<Trace, "parentId" | "parentSpanId">,
): string | null => {
  if (isRootSpan(item)) return null;

  const parentSpanId = item.parentSpanId?.trim() ?? "";
  if (parentSpanId && parentSpanId !== ZERO_PARENT_SPAN_ID) {
    return parentSpanId;
  }

  const parentId = item.parentId?.trim() ?? "";
  if (parentId && parentId !== ZERO_PARENT_SPAN_ID) {
    return parentId;
  }

  return null;
};

export const parseTraceEntryPoint = (operationName: string) => {
  const parts = operationName.trim().split(/\s+/);
  return {
    method: parts[0] ?? operationName,
    actionName: parts.slice(1).join(" ") || operationName,
  };
};

const toTraceTreeNode = (item: Trace): TraceTree => ({
  ...item,
  subEntries: [] as TraceTree[],
  issues: [],
  tags: {} as ITags,
  securityContext: {} as ISecurityContext,
  request: {} as IRequest,
  response: {} as IResponse,
  logs: [],
  entryPoint: parseTraceEntryPoint(item.operationName),
});

export const buildTraceTreeFromSpans = (spans: Trace[]): TraceTree | null => {
  if (!spans.length) return null;

  const map: Record<string, TraceTree> = {};
  const time = { start: "", end: "" };

  spans.forEach((item) => {
    map[item.spanId] = toTraceTreeNode(item);
  });

  spans.forEach((item) => {
    const parentKey = getParentSpanKey(item);
    if (parentKey && map[parentKey]) {
      map[parentKey].subEntries.push(map[item.spanId]);
    }
  });

  let rootSpan = spans.find(isRootSpan);

  // Fallback: if no root span found but there are spans, use the first span or the one with earliest start time
  if (!rootSpan) {
    // Try to find a span that has no parent in the spans list
    const spanIds = new Set(spans.map((s) => s.spanId));
    rootSpan = spans.find((s) => {
      const parentKey = getParentSpanKey(s);
      return !parentKey || !spanIds.has(parentKey);
    });

    // If still no root, use the first span
    if (!rootSpan) {
      rootSpan = spans[0];
    }
  }

  const parsedData = rootSpan ? map[rootSpan.spanId] : null;

  // Calculate time range
  spans.forEach((item) => {
    if (!time.start || new Date(time.start) > new Date(item.startTime)) {
      time.start = item.startTime;
    }
    if (!time.end || new Date(time.end) < new Date(item.endTime)) {
      time.end = item.endTime;
    }
  });

  if (parsedData) {
    parsedData.calculatedStartTime = time.start;
    parsedData.calculatedEndTime = time.end;
    parsedData.calculatedDuration =
      Number(new Date(time.end)) - Number(new Date(time.start));
  }

  return parsedData;
};

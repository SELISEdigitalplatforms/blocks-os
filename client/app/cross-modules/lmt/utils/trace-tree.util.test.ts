import { describe, expect, it } from "vitest";
import type { Trace } from "../models/trace.model";
import { buildTraceTreeFromSpans, getParentSpanKey, isRootSpan } from "./trace-tree.util";

const gatewayRootSpan: Trace = {
  timestamp: "2026-06-18T12:26:31.868Z",
  traceId: "3d2a43ba990062d01a43fcb6c6dc3643",
  spanId: "2a554ff854b52a75",
  parentSpanId: "0000000000000000",
  parentId: "",
  kind: "Server",
  activitySourceName: "blocks-data",
  operationName: "POST /api/gateway",
  startTime: "2026-06-18T12:26:31.864Z",
  endTime: "2026-06-18T12:26:31.868Z",
  duration: 3.8439,
  attributes: {},
  status: "Unset",
  statusDescription: "",
  baggage: { TenantId: "D7309c69a09964134b58902c3bcd5087b", IsFromCloud: "False" },
  serviceName: "blocks-data",
};

const gatewayChildSpan: Trace = {
  ...gatewayRootSpan,
  spanId: "05e2e9baa5c295ae",
  parentSpanId: "2a554ff854b52a75",
  parentId: "00-3d2a43ba990062d01a43fcb6c6dc3643-2a554ff854b52a75-01",
  kind: "Producer",
  operationName: "Redis::GetHashValue",
  duration: 0.7376,
};

describe("trace-tree.util", () => {
  it("should treat all-zero parentSpanId as root span", () => {
    expect(isRootSpan(gatewayRootSpan)).toBe(true);
  });

  it("should resolve parent link from parentSpanId not W3C parentId", () => {
    expect(getParentSpanKey(gatewayChildSpan)).toBe("2a554ff854b52a75");
  });

  it("should build tree for gateway trace response shape", () => {
    const tree = buildTraceTreeFromSpans([
      gatewayChildSpan,
      { ...gatewayChildSpan, spanId: "e754fa669c573854", operationName: "MongoDb::aggregate" },
      { ...gatewayChildSpan, spanId: "fde40fd8e72815d9", operationName: "MongoDb::find" },
      gatewayRootSpan,
    ]);

    expect(tree).not.toBeNull();
    expect(tree?.spanId).toBe("2a554ff854b52a75");
    expect(tree?.subEntries).toHaveLength(3);
    expect(tree?.entryPoint.method).toBe("POST");
    expect(tree?.entryPoint.actionName).toBe("/api/gateway");
  });
});

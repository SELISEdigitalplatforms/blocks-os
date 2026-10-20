import { describe, expect, it } from "vitest";
import type { TraceTree } from "../models/trace.model";
import { buildTraceFlow, classifySpan, getSpanOutcome } from "./trace-flow.util";

let seq = 0;
const span = (overrides: Partial<TraceTree> = {}): TraceTree =>
  ({
    timestamp: "2024-01-01T10:00:00.000Z",
    traceId: "trace-1",
    spanId: `span-${++seq}`,
    parentSpanId: "",
    parentId: "",
    kind: "Internal",
    activitySourceName: "source",
    operationName: "op",
    startTime: "2024-01-01T10:00:00.000Z",
    endTime: "2024-01-01T10:00:00.100Z",
    duration: 10,
    attributes: {},
    status: "Ok",
    statusDescription: "",
    baggage: { TenantId: "t", IsFromCloud: "false" },
    serviceName: "blocks-iam",
    entryPoint: { method: "", actionName: "" },
    issues: [],
    tags: { ecosystem: "", habitat: "", uriClient: "" },
    securityContext: {} as TraceTree["securityContext"],
    request: {} as TraceTree["request"],
    response: {} as TraceTree["response"],
    logs: [],
    subEntries: [],
    ...overrides,
  }) as TraceTree;

const at = (ms: number) => new Date(Date.UTC(2024, 0, 1, 10, 0, 0, ms)).toISOString();

describe("classifySpan", () => {
  it("maps Mongo spans to one shared database component", () => {
    const c = classifySpan(span({ operationName: "MongoDb::find", kind: "Producer" }));
    expect(c).toMatchObject({
      id: "db:mongodb",
      kind: "database",
      traffic: "data",
      tag: "MongoDB find",
    });
  });

  it("maps Redis producer spans to the cache and Redis consumers back to the service", () => {
    expect(classifySpan(span({ operationName: "Redis::Get", kind: "Producer" }))).toMatchObject({
      id: "cache:redis",
      kind: "cache",
      tag: "Redis Get",
    });
    const consumer = classifySpan(
      span({ operationName: "Redis::MessageReceived", kind: "Consumer", serviceName: "worker" }),
    );
    expect(consumer).toMatchObject({ id: "svc:worker", traffic: "cache" });
    expect(consumer.fromOverride).toMatchObject({ id: "cache:redis" });
  });

  it("maps a message publish to its queue and the consumer to the service that read it", () => {
    const publish = classifySpan(
      span({
        operationName: "messaging.azure.servicebus.send",
        kind: "Producer",
        attributes: {
          "messaging.system": "azure.servicebus",
          "messaging.destination": "logout-all",
          "messaging.message_type": "LogoutAllEvent",
        },
      }),
    );
    expect(publish).toMatchObject({
      id: "queue:logout-all",
      kind: "queue",
      traffic: "message",
      tag: "publish LogoutAllEvent",
    });

    const consume = classifySpan(
      span({
        operationName: "process.messaging.azure.service.bus",
        kind: "Consumer",
        serviceName: "iam-worker",
        attributes: { "messaging.destination.name": "logout-all" },
      }),
    );
    expect(consume).toMatchObject({
      id: "svc:iam-worker",
      traffic: "message",
      tag: "consume logout-all",
    });
    expect(consume.fromOverride).toMatchObject({ id: "queue:logout-all", kind: "queue" });
  });

  it("names outgoing HTTP calls after the host they called", () => {
    const c = classifySpan(
      span({
        operationName: "OutgoingHttpRequest",
        kind: "Client",
        attributes: {
          "url.full": "https://api.example.com/v1/users?x=1",
          "http.request.method": "POST",
        },
      }),
    );
    expect(c).toMatchObject({
      id: "ext:api.example.com",
      kind: "external",
      traffic: "http",
      tag: "POST /v1/users",
    });
  });

  it("prefers server.address over the URL host and tolerates a malformed URL", () => {
    const c = classifySpan(
      span({
        kind: "Client",
        attributes: { "server.address": "iam.local", "url.full": "not a url", method: "GET" },
      }),
    );
    expect(c).toMatchObject({ id: "ext:iam.local", tag: "GET" });
  });

  it("falls back to the activity source for unknown outbound spans", () => {
    const c = classifySpan(
      span({ kind: "Producer", activitySourceName: "Custom.Sdk", operationName: "Send" }),
    );
    expect(c).toMatchObject({ id: "ext:Custom.Sdk", kind: "external", traffic: "call" });
  });

  it("treats server and internal spans as the service itself, naming unknown services", () => {
    expect(classifySpan(span({ kind: "Server", operationName: "GET /api/users" }))).toMatchObject({
      id: "svc:blocks-iam",
      traffic: "http",
      tag: "GET /api/users",
    });
    expect(
      classifySpan(span({ serviceName: "", operationName: "", activitySourceName: "Worker.Job" })),
    ).toMatchObject({
      id: "svc:Unknown service",
      traffic: "call",
      tag: "Worker.Job",
    });
  });
});

describe("getSpanOutcome", () => {
  it("reads success from the HTTP status code", () => {
    expect(getSpanOutcome(span({ attributes: { "response.status.code": 200 } }))).toMatchObject({
      state: "ok",
      errorMessage: null,
    });
  });

  it("treats a span marked Error as failed even when its HTTP code looks fine", () => {
    const outcome = getSpanOutcome(
      span({
        status: "Error",
        statusDescription: "Timeout contacting Mongo",
        attributes: { "response.status.code": "200" },
      }),
    );
    expect(outcome).toEqual({
      state: "error",
      statusLabel: "Error",
      errorMessage: "Timeout contacting Mongo",
    });
  });

  it("recognises the error flags Genesis sets on Redis and HTTP spans", () => {
    expect(
      getSpanOutcome(
        span({
          // Genesis sets this as a boolean tag; the client type only admits strings and numbers.
          attributes: {
            Error: true,
            errorMessage: "READONLY replica",
          } as unknown as TraceTree["attributes"],
        }),
      ),
    ).toMatchObject({
      state: "error",
      errorMessage: "READONLY replica",
    });
    expect(getSpanOutcome(span({ attributes: { error: "connection refused" } }))).toMatchObject({
      state: "error",
      errorMessage: "connection refused",
    });
    expect(getSpanOutcome(span({ attributes: { error: "false" } })).state).toBe("ok");
  });

  it("reports 5xx as an error and 4xx as a warning, with the code as the message", () => {
    expect(
      getSpanOutcome(span({ status: "Unset", attributes: { "http.response.status_code": 503 } })),
    ).toMatchObject({
      state: "error",
      statusLabel: "503",
      errorMessage: "HTTP 503",
    });
    expect(
      getSpanOutcome(span({ status: "Unset", attributes: { "response.status.code": 404 } })),
    ).toMatchObject({
      state: "warning",
      errorMessage: "HTTP 404",
    });
  });

  it("does not claim success for an unset status", () => {
    expect(getSpanOutcome(span({ status: "Unset" }))).toMatchObject({
      state: "unknown",
      statusLabel: "Unknown",
    });
  });
});

describe("buildTraceFlow", () => {
  it("returns an empty flow for a missing trace", () => {
    expect(buildTraceFlow(null)).toEqual({
      nodes: [],
      steps: [],
      errorOriginIndex: -1,
      errorCount: 0,
      totalSpans: 0,
      truncated: false,
    });
  });

  it("starts a server root span at the caller and follows parents to children", () => {
    const db = span({ operationName: "MongoDb::find", kind: "Producer", startTime: at(20) });
    const root = span({
      kind: "Server",
      operationName: "GET /api/users",
      startTime: at(0),
      subEntries: [db],
    });
    const flow = buildTraceFlow(root);

    expect(flow.nodes.map((n) => n.id)).toEqual(["caller", "svc:blocks-iam", "db:mongodb"]);
    expect(flow.steps.map((s) => [s.fromId, s.toId, s.depth])).toEqual([
      ["caller", "svc:blocks-iam", 0],
      ["svc:blocks-iam", "db:mongodb", 1],
    ]);
    expect(flow.errorOriginIndex).toBe(-1);
  });

  it("routes a publish through its queue into the consuming worker", () => {
    const consumer = span({
      kind: "Consumer",
      operationName: "process.messaging.azure.service.bus",
      serviceName: "iam-worker",
      attributes: { "messaging.destination.name": "logout-all" },
      startTime: at(40),
    });
    const publish = span({
      kind: "Producer",
      operationName: "messaging.azure.servicebus.send",
      attributes: { "messaging.system": "azure.servicebus", "messaging.destination": "logout-all" },
      startTime: at(10),
      subEntries: [consumer],
    });
    const root = span({
      kind: "Server",
      operationName: "POST /auth/logout-all",
      subEntries: [publish],
    });
    const flow = buildTraceFlow(root);

    expect(flow.steps.map((s) => `${s.fromId}>${s.toId}`)).toEqual([
      "caller>svc:blocks-iam",
      "svc:blocks-iam>queue:logout-all",
      "queue:logout-all>svc:iam-worker",
    ]);
  });

  it("starts a root consumer at its queue and a root internal span inside its own service", () => {
    const consumerRoot = buildTraceFlow(
      span({
        kind: "Consumer",
        operationName: "process.messaging.rabbitmq",
        attributes: { "messaging.system": "rabbitmq" },
      }),
    );
    expect(consumerRoot.steps[0]).toMatchObject({
      fromId: "queue:rabbitmq",
      toId: "svc:blocks-iam",
    });

    const internalRoot = buildTraceFlow(span({ kind: "Internal", operationName: "Cleanup" }));
    expect(internalRoot.steps[0]).toMatchObject({
      fromId: "svc:blocks-iam",
      toId: "svc:blocks-iam",
    });
    expect(internalRoot.nodes).toHaveLength(1);
  });

  it("plays children in start order, parents first, with bad timestamps last", () => {
    const late = span({ operationName: "late", startTime: at(90) });
    const early = span({ operationName: "early", startTime: at(5) });
    const broken = span({ operationName: "broken", startTime: "not a date" });
    // Clock skew: the child says it started before its parent, but it still plays after it.
    const skewed = span({ operationName: "skewed-child", startTime: at(1) });
    const mid = span({ operationName: "mid", startTime: at(50), subEntries: [skewed] });
    const root = span({
      kind: "Server",
      operationName: "root",
      startTime: at(10),
      subEntries: [broken, late, mid, early],
    });

    expect(buildTraceFlow(root).steps.map((s) => s.operationName)).toEqual([
      "root",
      "early",
      "mid",
      "skewed-child",
      "late",
      "broken",
    ]);
  });

  it("skips a span it has already visited instead of looping", () => {
    const root = span({ kind: "Server", spanId: "a" });
    const child = span({ spanId: "b", subEntries: [root] });
    root.subEntries = [child, child];
    const flow = buildTraceFlow(root);
    expect(flow.steps.map((s) => s.spanId)).toEqual(["a", "b"]);
    expect(flow.totalSpans).toBe(2);
  });

  it("marks the deepest failing span as the origin and its callers as propagated", () => {
    const db = span({
      operationName: "MongoDb::insert",
      kind: "Producer",
      status: "Error",
      statusDescription: "E11000 duplicate key",
      startTime: at(20),
    });
    const ok = span({ operationName: "Redis::Get", kind: "Producer", startTime: at(10) });
    const service = span({
      operationName: "CreateUser",
      status: "Error",
      startTime: at(15),
      subEntries: [db],
    });
    const root = span({
      kind: "Server",
      operationName: "POST /users",
      status: "Unset",
      attributes: { "response.status.code": 500 },
      subEntries: [ok, service],
    });
    const flow = buildTraceFlow(root);
    const byOp = Object.fromEntries(flow.steps.map((s) => [s.operationName, s]));

    expect(byOp["MongoDb::insert"]).toMatchObject({
      isErrorOrigin: true,
      isPropagatedError: false,
      errorMessage: "E11000 duplicate key",
    });
    expect(byOp.CreateUser).toMatchObject({
      isErrorOrigin: false,
      isPropagatedError: true,
      causedByIndex: byOp["MongoDb::insert"].index,
    });
    expect(byOp["POST /users"]).toMatchObject({
      isPropagatedError: true,
      causedByIndex: byOp["MongoDb::insert"].index,
    });
    expect(byOp["Redis::Get"].state).toBe("ok");
    expect(flow.errorOriginIndex).toBe(byOp["MongoDb::insert"].index);
    expect(flow.errorCount).toBe(3);
    expect(flow.nodes.find((n) => n.id === "db:mongodb")).toMatchObject({
      hasError: true,
      isErrorOrigin: true,
    });
    expect(flow.nodes.find((n) => n.id === "cache:redis")).toMatchObject({
      hasError: false,
      isErrorOrigin: false,
    });
  });

  it("keeps separate origins when two branches fail on their own", () => {
    const a = span({ operationName: "a", status: "Error", startTime: at(1) });
    const b = span({ operationName: "b", status: "Error", startTime: at(2) });
    const flow = buildTraceFlow(
      span({ kind: "Server", operationName: "root", subEntries: [a, b] }),
    );
    expect(flow.steps.filter((s) => s.isErrorOrigin).map((s) => s.operationName)).toEqual([
      "a",
      "b",
    ]);
    expect(flow.errorOriginIndex).toBe(1);
  });

  it("treats a failing span whose children all succeeded as the origin", () => {
    const child = span({ operationName: "child", startTime: at(1) });
    const flow = buildTraceFlow(
      span({ kind: "Server", operationName: "root", status: "Error", subEntries: [child] }),
    );
    expect(flow.steps[0]).toMatchObject({ isErrorOrigin: true, causedByIndex: null });
  });

  it("caps long traces but keeps every failing span and the calls that led to it", () => {
    const failing = span({ operationName: "failing", status: "Error", startTime: at(900) });
    const parent = span({ operationName: "parent", startTime: at(800), subEntries: [failing] });
    const fillers = Array.from({ length: 8 }, (_, i) =>
      span({ operationName: `filler-${i}`, startTime: at(i + 1) }),
    );
    const root = span({ kind: "Server", operationName: "root", subEntries: [...fillers, parent] });
    const flow = buildTraceFlow(root, 5);

    expect(flow.truncated).toBe(true);
    expect(flow.totalSpans).toBe(11);
    expect(flow.steps.map((s) => s.operationName)).toEqual([
      "root",
      "filler-0",
      "filler-1",
      "parent",
      "failing",
    ]);
    expect(flow.steps.map((s) => s.index)).toEqual([0, 1, 2, 3, 4]);
    expect(flow.steps[flow.errorOriginIndex].operationName).toBe("failing");
  });

  it("uses zero for a missing duration", () => {
    const flow = buildTraceFlow(span({ kind: "Server", duration: Number.NaN }));
    expect(flow.steps[0].durationMs).toBe(0);
  });
});

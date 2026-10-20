import { describe, expect, it } from "vitest";
import type { TraceTree } from "@blocks-lmt/models/trace.model";
import { buildTraceFlow } from "@blocks-lmt/utils/trace-flow.util";
import {
  buildPlotLine,
  buildTimeline,
  getErrorPath,
  getParentIndexes,
  getSlowestStep,
  logServiceOf,
  plural,
} from "./trace-story.util";

let seq = 0;
const span = (overrides: Partial<TraceTree> = {}): TraceTree => {
  seq += 1;
  return {
    traceId: "trace-1",
    spanId: `span-${seq}`,
    kind: "Internal",
    activitySourceName: "src",
    operationName: "op",
    startTime: "2024-01-01T10:00:00.000Z",
    endTime: "2024-01-01T10:00:00.100Z",
    duration: 100,
    attributes: {},
    status: "Ok",
    statusDescription: "",
    serviceName: "blocks-iam",
    subEntries: [],
    ...overrides,
  } as TraceTree;
};

const at = (ms: number) => new Date(Date.UTC(2024, 0, 1, 10, 0, 0, ms)).toISOString();

const failing = () =>
  span({
    kind: "Server",
    operationName: "POST /orders",
    attributes: { "response.status.code": 500 },
    status: "Unset",
    subEntries: [
      span({ operationName: "Redis::Get", kind: "Producer", startTime: at(10), duration: 5 }),
      span({
        operationName: "worker",
        startTime: at(20),
        duration: 70,
        status: "Error",
        subEntries: [
          span({
            operationName: "MongoDb::update",
            kind: "Producer",
            status: "Error",
            statusDescription: "E11000 duplicate key",
            startTime: at(30),
            duration: 60,
            serviceName: "inventory-worker",
          }),
        ],
      }),
    ],
  });

const labelOf = (id: string) => id.replace(/^\w+:/, "");

describe("trace story helpers", () => {
  it("finds the caller of every step from the pre-order depth", () => {
    const flow = buildTraceFlow(failing());
    expect(getParentIndexes(flow.steps)).toEqual([-1, 0, 0, 2]);
  });

  it("places bars as percentages of the whole trace", () => {
    const flow = buildTraceFlow(failing());
    const { totalMs, timings } = buildTimeline(flow, getParentIndexes(flow.steps));
    expect(totalMs).toBe(100);
    expect(timings[1]).toMatchObject({ offsetPercent: 10, widthPercent: 5, untimed: false });
    expect(timings[3].offsetPercent).toBe(30);
  });

  it("marks spans without a start time and spans that start before their caller", () => {
    const flow = buildTraceFlow(
      span({
        startTime: at(50),
        subEntries: [
          span({ startTime: "", operationName: "lost" }),
          span({ startTime: at(10), operationName: "early" }),
        ],
      }),
    );
    const { timings } = buildTimeline(flow, getParentIndexes(flow.steps));
    const lost = flow.steps.findIndex((s) => s.operationName === "lost");
    const early = flow.steps.findIndex((s) => s.operationName === "early");
    expect(timings[lost]).toMatchObject({ untimed: true, widthPercent: 0 });
    expect(timings[early].skewed).toBe(true);
    expect(timings[early].offsetPercent).toBeGreaterThanOrEqual(0);
  });

  it("keeps bars inside the axis when a span claims more time than the trace", () => {
    const flow = buildTraceFlow(span({ subEntries: [span({ startTime: at(90), duration: 500 })] }));
    const { timings } = buildTimeline(flow, getParentIndexes(flow.steps));
    timings.forEach((t) => expect(t.offsetPercent + t.widthPercent).toBeLessThanOrEqual(100));
  });

  it("collects only the failing steps and the steps that called them", () => {
    const flow = buildTraceFlow(failing());
    expect([...getErrorPath(flow, getParentIndexes(flow.steps))].sort((a, b) => a - b)).toEqual([
      0, 2, 3,
    ]);
  });

  it("says where a failing trace broke and why", () => {
    const flow = buildTraceFlow(failing());
    const plot = buildPlotLine(flow, labelOf);
    expect(plot.tone).toBe("error");
    expect(plot.headline).toBe("It broke at step 4.");
    expect(plot.detail).toContain("E11000 duplicate key");
    expect(plot.detail).toContain("2 other steps failed because of it.");
    expect(plot.stepIndex).toBe(3);
  });

  it("names the slowest step of a trace that finished", () => {
    const flow = buildTraceFlow(
      span({
        subEntries: [
          span({ operationName: "fast", duration: 5 }),
          span({ operationName: "slow", duration: 80 }),
        ],
      }),
    );
    const plot = buildPlotLine(flow, labelOf);
    expect(plot.tone).toBe("ok");
    expect(plot.headline).toContain("Finished without errors");
    expect(plot.detail).toContain("slow");
    expect(getSlowestStep(flow)?.operationName).toBe("slow");
  });

  it("handles a trace with a single step", () => {
    const flow = buildTraceFlow(span());
    expect(getSlowestStep(flow)).toBeNull();
    expect(buildPlotLine(flow, labelOf)).toMatchObject({
      detail: "Only one step was recorded.",
      stepIndex: null,
    });
  });

  it("reads a step's logs from the service that ran it, not from the database", () => {
    const flow = buildTraceFlow(failing());
    expect(logServiceOf(flow.steps[3])).toBe("inventory-worker");
  });

  it("pluralises counts", () => {
    expect(plural(1, "step")).toBe("1 step");
    expect(plural(3, "step")).toBe("3 steps");
  });
});

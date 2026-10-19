import type { FlowStep, TraceFlow } from "@blocks-lmt/utils/trace-flow.util";
import { formatDurationMs } from "@blocks-lmt/utils";

/**
 * Pure helpers behind the story waterfall: where each bar sits on the time axis, which step
 * called which, the path that leads to an error, and the one-line summary at the top. None of
 * them render anything, so every rule about placement and wording is unit-tested here.
 */

export interface StepTiming {
  /** Left edge and length as percentages of the whole trace. */
  offsetPercent: number;
  widthPercent: number;
  /** The span has no usable start time, so its bar cannot be placed. */
  untimed: boolean;
  /** The span starts before the step that called it: the hosts' clocks disagree. */
  skewed: boolean;
}

export interface TraceTimeline {
  originMs: number;
  totalMs: number;
  timings: StepTiming[];
}

export const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const parseTime = (value: string) => {
  const ms = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(ms) ? ms : null;
};

/** Index of the step that called each step, or -1 for the first one. Steps are in pre-order,
 *  so the caller is the nearest earlier step one level up. */
export const getParentIndexes = (steps: FlowStep[]) => {
  const lastAtDepth: number[] = [];
  return steps.map((step) => {
    lastAtDepth[step.depth] = step.index;
    lastAtDepth.length = step.depth + 1;
    return step.depth > 0 ? (lastAtDepth[step.depth - 1] ?? -1) : -1;
  });
};

export const buildTimeline = (flow: TraceFlow, parents: number[]): TraceTimeline => {
  const starts = flow.steps.map((step) => parseTime(step.startTime));
  const known = starts.filter((ms): ms is number => ms !== null);
  const originMs = known.length ? Math.min(...known) : 0;
  const ends = flow.steps.map((step, i) => (starts[i] ?? originMs) + Math.max(step.durationMs, 0));
  const rootDuration = Math.max(flow.steps[0]?.durationMs ?? 0, 0);
  const totalMs = Math.max(rootDuration, ...ends.map((end) => end - originMs), 0);
  const scale = totalMs > 0 ? 100 / totalMs : 0;

  const timings = flow.steps.map((step, i) => {
    const start = starts[i];
    if (start === null) return { offsetPercent: 0, widthPercent: 0, untimed: true, skewed: false };
    const parentStart = parents[i] >= 0 ? starts[parents[i]] : null;
    const offsetPercent = clamp((start - originMs) * scale, 0, 100);
    return {
      offsetPercent,
      widthPercent: clamp(Math.max(step.durationMs, 0) * scale, 0, 100 - offsetPercent),
      untimed: false,
      skewed: parentStart !== null && start < parentStart,
    };
  });

  return { originMs, totalMs, timings };
};

/** Every failing step plus the steps that called it, so the reader can follow only the
 *  calls that lead to a failure. */
export const getErrorPath = (flow: TraceFlow, parents: number[]) => {
  const path = new Set<number>();
  flow.steps.forEach((step) => {
    if (step.state !== "error") return;
    for (let i = step.index; i >= 0 && !path.has(i); i = parents[i]) path.add(i);
  });
  return path;
};

export const getSlowestStep = (flow: TraceFlow) =>
  flow.steps
    .slice(1)
    .reduce<FlowStep | null>(
      (slowest, step) => (!slowest || step.durationMs > slowest.durationMs ? step : slowest),
      null,
    );

export interface PlotLine {
  tone: "error" | "ok";
  headline: string;
  detail: string;
  /** The step the plot line points at, when there is one. */
  stepIndex: number | null;
}

export const buildPlotLine = (flow: TraceFlow, labelOf: (id: string) => string): PlotLine => {
  const origin = flow.steps[flow.errorOriginIndex];
  if (origin) {
    const where =
      origin.fromId === origin.toId
        ? `${labelOf(origin.toId)} failed while running ${origin.tag}`
        : `${labelOf(origin.fromId)} could not complete ${origin.tag} on ${labelOf(origin.toId)}`;
    const reason = origin.errorMessage ? `: ${origin.errorMessage}` : "";
    const others = flow.errorCount - 1;
    const spread = others > 0 ? ` ${plural(others, "other step")} failed because of it.` : "";
    return {
      tone: "error",
      headline: `It broke at step ${origin.index + 1}.`,
      detail: `${where}${reason}.${spread}`,
      stepIndex: origin.index,
    };
  }
  const slowest = getSlowestStep(flow);
  const total = formatDurationMs(flow.steps[0]?.durationMs ?? 0);
  return {
    tone: "ok",
    headline: `Finished without errors in ${total}.`,
    detail: slowest
      ? `The slowest step was step ${slowest.index + 1}, ${slowest.tag} (${formatDurationMs(slowest.durationMs)}).`
      : "Only one step was recorded.",
    stepIndex: slowest?.index ?? null,
  };
};

/** The service whose logs describe a step: the one that ran the span. Databases, caches and
 *  brokers never write to the tenant's logs. */
export const logServiceOf = (step: FlowStep) => step.serviceName || step.span.serviceName || "";

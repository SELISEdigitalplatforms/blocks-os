import type { FlowStep, TraceFlow } from "@blocks-lmt/utils/trace-flow.util";
import { formatDurationMs } from "@blocks-lmt/utils";

/**
 * Pure helpers behind the story waterfall: where each bar sits on the time axis, which step
 * called which, the path that leads to an error, and the one-line summary at the top. None of
 * them render anything, so every rule about placement and wording is unit-tested here.
 */

export interface StepTiming {
  /** Left edge and length as percentages of the axis the step is drawn on. */
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

/** The earliest known start of any step: the zero of the trace. */
export const getTraceOriginMs = (flow: TraceFlow) => {
  const known = flow.steps
    .map((step) => parseTime(step.startTime))
    .filter((ms): ms is number => ms !== null);
  return known.length ? Math.min(...known) : 0;
};

/** Places the given steps on their own axis: zero is the earliest of them and the end is the
 *  latest end, so a service that ran long after the request still fills the width. Timings
 *  come back in the order of `indexes`. */
export const buildTimeline = (
  flow: TraceFlow,
  parents: number[],
  indexes: number[] = flow.steps.map((step) => step.index),
): TraceTimeline => {
  const steps = indexes.map((i) => flow.steps[i]);
  const allStarts = flow.steps.map((step) => parseTime(step.startTime));
  const starts = indexes.map((i) => allStarts[i]);
  const known = starts.filter((ms): ms is number => ms !== null);
  const originMs = known.length ? Math.min(...known) : 0;
  const ends = steps.map((step, i) => (starts[i] ?? originMs) + Math.max(step.durationMs, 0));
  const rootDuration = Math.max(steps[0]?.durationMs ?? 0, 0);
  const totalMs = Math.max(rootDuration, ...ends.map((end) => end - originMs), 0);
  const scale = totalMs > 0 ? 100 / totalMs : 0;

  const timings = steps.map((step, i) => {
    const start = starts[i];
    if (start === null) return { offsetPercent: 0, widthPercent: 0, untimed: true, skewed: false };
    const parent = parents[step.index];
    const parentStart = parent >= 0 ? allStarts[parent] : null;
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

/** One service's part of the trace: the step where the work entered the service and every
 *  step it ran before handing work to another service. */
export interface ServiceLevel {
  id: number;
  service: string;
  /** The step where the work entered this service. */
  rootIndex: number;
  /** The level that handed work to this one, or -1 for the first service. */
  parentLevel: number;
  /** The step in the parent level that called or published into this level, or -1. */
  enteredFrom: number;
  /** Reached through a message, so it runs on its own clock, often after the request ended. */
  isEvent: boolean;
  /** How long after the publishing step started this level started, when both are known. */
  delayMs: number | null;
  /** Step indexes in this level, in pre-order. */
  steps: number[];
  /** A step in this level, or in any level it led to, failed. */
  hasError: boolean;
  /** Steps in this level and every level below it. */
  totalSteps: number;
}

export interface ServiceSummary {
  service: string;
  steps: number;
  hasError: boolean;
  /** Every level of this service was reached through a message. */
  eventOnly: boolean;
  /** The first level of this service, in story order. */
  firstLevel: number;
}

export interface ServiceLevels {
  levels: ServiceLevel[];
  /** The level each step belongs to. */
  levelOf: number[];
  /** The levels each step opens, keyed by step index. */
  opens: Map<number, number[]>;
  services: ServiceSummary[];
}

/** Splits the story by service: a step starts a new level when it ran in a different service
 *  from the step that called it. A step with no service name stays with its caller. */
export const buildServiceLevels = (flow: TraceFlow, parents: number[]): ServiceLevels => {
  const services: string[] = [];
  const levelOf: number[] = [];
  const levels: ServiceLevel[] = [];
  const opens = new Map<number, number[]>();

  flow.steps.forEach((step, i) => {
    const parent = parents[i] ?? -1;
    const inherited = parent >= 0 ? services[parent] : "";
    services[i] = step.serviceName || inherited || "";
    if (parent >= 0 && services[i] === services[parent]) {
      levelOf[i] = levelOf[parent];
      levels[levelOf[i]].steps.push(i);
      return;
    }
    const isEvent = parent >= 0 && step.traffic === "message";
    const start = parseTime(step.startTime);
    const callerStart = parent >= 0 ? parseTime(flow.steps[parent].startTime) : null;
    const level: ServiceLevel = {
      id: levels.length,
      service: services[i] || "Unknown service",
      rootIndex: i,
      parentLevel: parent >= 0 ? levelOf[parent] : -1,
      enteredFrom: parent,
      isEvent,
      delayMs: isEvent && start !== null && callerStart !== null ? start - callerStart : null,
      steps: [i],
      hasError: false,
      totalSteps: 0,
    };
    levels.push(level);
    levelOf[i] = level.id;
    if (parent >= 0) opens.set(parent, [...(opens.get(parent) ?? []), level.id]);
  });

  // Levels are created in pre-order, so every child level comes after its parent.
  for (let id = levels.length - 1; id >= 0; id--) {
    const level = levels[id];
    level.totalSteps += level.steps.length;
    if (level.steps.some((i) => flow.steps[i].state === "error")) level.hasError = true;
    const up = levels[level.parentLevel];
    if (up) {
      up.totalSteps += level.totalSteps;
      if (level.hasError) up.hasError = true;
    }
  }

  const summaries = new Map<string, ServiceSummary>();
  levels.forEach((level) => {
    const failed = level.steps.some((i) => flow.steps[i].state === "error");
    const known = summaries.get(level.service);
    if (known) {
      known.steps += level.steps.length;
      known.hasError ||= failed;
      known.eventOnly &&= level.isEvent;
      return;
    }
    summaries.set(level.service, {
      service: level.service,
      steps: level.steps.length,
      hasError: failed,
      eventOnly: level.isEvent,
      firstLevel: level.id,
    });
  });

  return { levels, levelOf, opens, services: [...summaries.values()] };
};

/** The levels from the first service down to the given one. */
export const getLevelPath = (levels: ServiceLevel[], id: number) => {
  const path: ServiceLevel[] = [];
  for (let level = levels[id]; level; level = levels[level.parentLevel]) path.unshift(level);
  return path;
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
      headline: `It broke in ${origin.serviceName || labelOf(origin.fromId)}.`,
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
      ? `The slowest step was ${slowest.tag} in ${slowest.serviceName || labelOf(slowest.fromId)} (${formatDurationMs(slowest.durationMs)}).`
      : "Only one step was recorded.",
    stepIndex: slowest?.index ?? null,
  };
};

/** The service whose logs describe a step: the one that ran the span. Databases, caches and
 *  brokers never write to the tenant's logs. */
export const logServiceOf = (step: FlowStep) => step.serviceName || step.span.serviceName || "";

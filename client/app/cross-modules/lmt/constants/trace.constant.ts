import { SERVICES } from "./services.constant";

/**
 * Storage tier used to keep tracing telemetry. Determines how traces are
 * routed and how long they remain queryable.
 */
export enum TRACE_PROVIDERS {
  /** Hot storage: fast, expensive, short retention (most recent traces). */
  hot = "hot",
  /** Cold storage: slower, cheaper, medium retention. */
  cold = "cold",
  /** Archive storage: slowest, cheapest, very long retention. */
  archive = "archive",
}

export const CLOUD_BUILTIN_SERVICES = SERVICES.filter((s) => s.showInTraces).map((s) => ({
  label: s.label,
  value: `blocks-${s.serviceName}-api` as const,
}));

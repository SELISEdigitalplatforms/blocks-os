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

export enum TRACE_REQUEST_SOURCE_TYPE {
  hot = "Hot",
  cold = "Cold",
  archive = "Archive",
}

export enum TRACE_REQUEST_STATUS {
  pending = "Pending",
  processing = "InProgress",
  completed = "Completed",
  partialSuccess = "PartialSuccess",
  failed = "Failed",
}

export const COLD_TRACE_RANGE_DAYS = { MIN: 31, MAX: 120 };
export const ARCHIVE_TRACE_RANGE_DAYS = { MIN: 121, MAX: 180 };
export const MAX_TRACE_REQUEST_DAYS = 7;

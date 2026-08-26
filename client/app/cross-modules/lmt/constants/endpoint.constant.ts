// ─── Log endpoints ────────────────────────────────────────────────────────────

const LOG_SUBPATH = "/Log";

export const LOG_ENDPOINTS = {
  GET_LOGS: `/api${LOG_SUBPATH}/GetLogs`,
  GET_LOGS_BY_DATE: `/api${LOG_SUBPATH}/GetLogsByDate`,
  LIVE: `/api${LOG_SUBPATH}/Live`,
  GET_BLOCKS_SERVICES: `/api${LOG_SUBPATH}/GetBlocksServices`,
} as const;

// ─── Trace endpoints ──────────────────────────────────────────────────────────

const TRACE_SUBPATH = "/Trace";

export const TRACE_ENDPOINTS = {
  GET_TRACES: `/api${TRACE_SUBPATH}/GetTraces`,
  GET_TRACE: `/api${TRACE_SUBPATH}/GetTrace`,
  GET_OPERATIONAL_ANALYTICS: `/api${TRACE_SUBPATH}/GetOperationalAnalytics`,
  GET_SERVICE_ANALYTICS: `/api${TRACE_SUBPATH}/GetServiceAnalytics`,
  GET_BLOCKS_SERVICES: `/api${TRACE_SUBPATH}/GetBlocksServices`,
} as const;

const RESTORE_SUBPATH = "/LogAndTraceRestore";

export const RESTORE_ENDPOINTS = {
  GET_REQUEST_ID: `/api${RESTORE_SUBPATH}/GetRequestId`,
  START_COLD_TRACE: `/api${RESTORE_SUBPATH}/StartColdRestoreProcess`,
  START_ARCHIVE_TRACE: `/api${RESTORE_SUBPATH}/StartArchiveRestoreProcess`,
  GET_TRACE_STATUS: `/api${RESTORE_SUBPATH}/Status`,
  GET_RESTORED_TRACES: `/api${RESTORE_SUBPATH}/GetRestoredTraces`,
  GET_RESTORED_TRACE: `/api${RESTORE_SUBPATH}/GetRestoredTrace`,
  GET_RESTORED_LOGS_BY_TRACE: `/api${RESTORE_SUBPATH}/GetRestoredLogsByTrace`,
  GET_RESTORED_DATA_RETENTION_DAYS: `/api${RESTORE_SUBPATH}/GetHotDataBlobUploadInDays`,
} as const;

import { useState } from "react";
import { useGetLogs, useGetRestoredLogs } from "@blocks-lmt/hooks/use-log";
import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import { LogStackTrace } from "../../log-stack-trace";

const PAGE_SIZE = 25;

/** Mounted only when the reader asks for evidence. Query the exact producing service and span. */
export const TraceFlowEvidence = ({ step, requestId }: { step: FlowStep; requestId?: string }) => {
  const [page, setPage] = useState(0);
  const span = step.span;
  const payload = {
    page,
    pageSize: PAGE_SIZE,
    serviceName: span.serviceName,
    sort: { property: "timestamp", isDescending: false },
    filter: { traceId: span.traceId, spanId: span.spanId },
  };
  const valid = Boolean(span.traceId && span.spanId && span.serviceName);
  const normal = useGetLogs(payload, { enabled: valid && !requestId });
  const restored = useGetRestoredLogs(
    { ...payload, requestId: requestId ?? "" },
    { enabled: valid && Boolean(requestId) },
  );
  const query = requestId ? restored : normal;
  const records = (query.data?.data ?? []).filter(
    (log) =>
      log.traceId === span.traceId &&
      log.spanId === span.spanId &&
      (!log.serviceName || log.serviceName === span.serviceName),
  );
  if (!valid)
    return (
      <p className="tf-evidence-state">This event has no complete log correlation identifiers.</p>
    );
  if (query.isLoading || query.isFetching)
    return (
      <output className="tf-evidence-state block">Finding the records behind this moment…</output>
    );
  if (query.isError)
    return (
      <div className="tf-evidence-state" role="alert">
        The log records could not be loaded.{" "}
        <button type="button" onClick={() => query.refetch()}>
          Try again
        </button>
      </div>
    );
  return (
    <div className="tf-evidence" aria-label="Log evidence">
      <p className="tf-evidence-intro">
        Original log records from <strong>{span.serviceName}</strong>, matched to this event.
      </p>
      {records.length ? (
        <ol>
          {records.map((log, index) => (
            <li key={`${log.timestamp}:${page}:${index}`}>
              <div className="tf-evidence-meta">
                <span className="tf-evidence-reference">L{page * PAGE_SIZE + index + 1}</span>
                <time dateTime={log.timestamp}>{log.timestamp}</time>
                <span>{log.level}</span>
              </div>
              <blockquote>{log.message}</blockquote>
              <LogStackTrace exception={log.exception} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="tf-evidence-state">
          No matching log records were returned for this event. The recorded trace still provides
          its operation, timing and status.
        </p>
      )}
      <details className="tf-evidence-correlation">
        <summary>How this evidence is linked</summary>
        <dl>
          <dt>Trace</dt>
          <dd>{span.traceId}</dd>
          <dt>Event</dt>
          <dd>{span.spanId}</dd>
          <dt>Service</dt>
          <dd>{span.serviceName}</dd>
        </dl>
      </details>
      {page > 0 || (query.data?.totalCount ?? 0) > PAGE_SIZE ? (
        <div className="tf-evidence-pages">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)}>
            Previous records
          </button>
          <span>Page {page + 1}</span>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= (query.data?.totalCount ?? 0)}
            onClick={() => setPage(page + 1)}
          >
            Next records
          </button>
        </div>
      ) : null}
    </div>
  );
};

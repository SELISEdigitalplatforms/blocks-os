import { useState } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import { cn } from "@/lib/utils";
import { useGetLogs, useGetRestoredLogs } from "@blocks-lmt/hooks/use-log";
import type { IGetLogsPayload, ILog } from "@blocks-lmt/models/log.model";
import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import {
  formatDurationMs,
  getLogFormatTimestamp,
  getLogLevelBadgeVariant,
  getLogLevelLabel,
} from "@blocks-lmt/utils";
import { LogStackTrace } from "../../log-stack-trace";
import { logServiceOf } from "./trace-story.util";

export const LOG_PAGE_SIZE = 25;

export type LogScope = "step" | "service";

interface LogsQuery {
  payload: IGetLogsPayload;
  enabled: boolean;
  requestId?: string;
}

/** Normal and restored traces read their logs from different stores; only one is enabled. */
const useTraceLogs = ({ payload, enabled, requestId }: LogsQuery) => {
  const normal = useGetLogs(payload, { enabled: enabled && !requestId });
  const restored = useGetRestoredLogs(
    { ...payload, requestId: requestId ?? "" },
    { enabled: enabled && Boolean(requestId) },
  );
  return requestId ? restored : normal;
};

const emptyReason = (step: FlowStep) => {
  if (step.traffic === "data")
    return "This is a database call. The database does not write to your logs; the service that made the call does.";
  if (step.traffic === "cache")
    return "This is a cache call. The cache does not write to your logs; the service that made the call does.";
  return `${logServiceOf(step) || "The service"} wrote nothing while this step ran.`;
};

/** "+176 ms" from the start of the trace; a record from a host whose clock runs early can
 *  land before it. Falls back to the clock time when the timestamp cannot be read. */
const logOffset = (timestamp: string, originMs: number) => {
  const ms = Date.parse(timestamp);
  if (!Number.isFinite(ms)) return getLogFormatTimestamp(timestamp);
  const offset = ms - originMs;
  return offset < 0 ? `−${formatDurationMs(-offset)}` : `+${formatDurationMs(offset)}`;
};

const LogRow = ({
  log,
  originMs,
  stepOf,
  onSelectStep,
}: {
  log: ILog;
  originMs: number;
  stepOf?: (spanId?: string) => FlowStep | undefined;
  onSelectStep: (index: number) => void;
}) => {
  const step = stepOf?.(log.spanId);
  const failed = getLogLevelBadgeVariant(log.level) === "error";
  return (
    <li
      className={cn(
        "grid grid-cols-[60px_minmax(0,1fr)] gap-x-3 border-b border-border px-5 py-3",
        failed && "bg-error/5",
      )}
    >
      <time
        dateTime={log.timestamp}
        title={getLogFormatTimestamp(log.timestamp)}
        className="pt-0.5 font-mono text-[11px] tabular-nums text-low-emphasis"
      >
        {logOffset(log.timestamp, originMs)}
      </time>
      <div className="flex min-w-0 flex-col gap-1.5">
        <Badge
          variant={getLogLevelBadgeVariant(log.level)}
          className="self-start py-0 text-[10px] uppercase tracking-wider"
        >
          {getLogLevelLabel(log.level)}
        </Badge>
        <p className="whitespace-pre-wrap wrap-break-word text-sm leading-relaxed text-high-emphasis">
          {log.message}
        </p>
        <LogStackTrace exception={log.exception} />
        {step ? (
          <button
            type="button"
            className="self-start font-mono text-[11px] text-primary hover:underline"
            onClick={() => onSelectStep(step.index)}
          >
            Go to step: {step.tag}
          </button>
        ) : null}
      </div>
    </li>
  );
};

const buildLogsPayload = (
  scope: LogScope,
  step: FlowStep,
  service: string,
  errorsOnly: boolean,
  page: number,
): IGetLogsPayload => {
  const span = step.span;
  const level = errorsOnly ? { level: "Error" } : {};
  if (scope === "step")
    return {
      page,
      pageSize: LOG_PAGE_SIZE,
      serviceName: logServiceOf(step),
      filter: { traceId: span.traceId, spanId: span.spanId, ...level },
    };
  return {
    page,
    pageSize: LOG_PAGE_SIZE,
    serviceName: service,
    filter: { traceId: span.traceId, ...level },
  };
};

const emptyTitle = (scope: LogScope, service: string) =>
  scope === "step"
    ? "No logs were written during this step."
    : `${service} wrote no logs in this trace.`;

const EmptyLogs = ({
  scope,
  step,
  service,
  parent,
  errorsOnly,
  onSelectStep,
  onScopeChange,
}: {
  scope: LogScope;
  step: FlowStep;
  service: string;
  parent?: FlowStep;
  errorsOnly: boolean;
  onSelectStep: (index: number) => void;
  onScopeChange: (scope: LogScope) => void;
}) => {
  const forStep = scope === "step";
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-6 text-sm">
      <p className="font-semibold text-high-emphasis">
        {errorsOnly ? "No errors were logged here." : emptyTitle(scope, service)}
      </p>
      {forStep && !errorsOnly ? <p className="text-medium-emphasis">{emptyReason(step)}</p> : null}
      {forStep && parent ? (
        <Button size="sm" type="button" onClick={() => onSelectStep(parent.index)}>
          Show logs of the step that called it
        </Button>
      ) : null}
      {forStep ? (
        <Button size="sm" variant="outline" type="button" onClick={() => onScopeChange("service")}>
          Show all logs of {service}
        </Button>
      ) : null}
    </div>
  );
};

const LogsPager = ({
  page,
  total,
  setPage,
}: {
  page: number;
  total: number;
  setPage: (page: number) => void;
}) => (
  <div className="flex items-center justify-between gap-3 px-5 py-3 text-xs">
    <Button
      size="sm"
      variant="outline"
      type="button"
      disabled={page === 0}
      onClick={() => setPage(page - 1)}
    >
      Newer records
    </Button>
    <span className="text-medium-emphasis">Page {page + 1}</span>
    <Button
      size="sm"
      variant="outline"
      type="button"
      disabled={(page + 1) * LOG_PAGE_SIZE >= total}
      onClick={() => setPage(page + 1)}
    >
      Older records
    </Button>
  </div>
);

const LogsBody = ({
  scope,
  step,
  service,
  parent,
  originMs,
  errorsOnly,
  requestId,
  stepOf,
  onSelectStep,
  onScopeChange,
}: {
  scope: LogScope;
  step: FlowStep;
  service: string;
  parent?: FlowStep;
  originMs: number;
  errorsOnly: boolean;
  requestId?: string;
  stepOf: (spanId?: string) => FlowStep | undefined;
  onSelectStep: (index: number) => void;
  onScopeChange: (scope: LogScope) => void;
}) => {
  const [page, setPage] = useState(0);
  const payload = buildLogsPayload(scope, step, service, errorsOnly, page);
  const hasSpan = scope === "service" || Boolean(step.span.spanId);
  const valid = Boolean(step.span.traceId && payload.serviceName) && hasSpan;
  const query = useTraceLogs({ payload, enabled: valid, requestId });
  // The API answers newest first; a story reads oldest first, so each page is turned around.
  const records = [...(query.data?.data ?? [])].reverse();
  const total = query.data?.totalCount ?? 0;

  if (!valid)
    return (
      <p className="px-5 py-6 text-sm text-medium-emphasis">
        This step has no complete trace, span or service id, so its logs cannot be matched.
      </p>
    );
  if (query.isLoading || query.isFetching)
    return (
      <output className="block px-5 py-6 text-sm text-medium-emphasis">Loading the logs…</output>
    );
  if (query.isError)
    return (
      <div className="flex flex-col items-start gap-3 px-5 py-6 text-sm" role="alert">
        <p className="text-error">The logs could not be loaded.</p>
        <Button size="sm" variant="outline" type="button" onClick={() => query.refetch()}>
          Try again
        </Button>
      </div>
    );
  if (!records.length)
    return (
      <EmptyLogs
        scope={scope}
        step={step}
        service={service}
        parent={parent}
        errorsOnly={errorsOnly}
        onSelectStep={onSelectStep}
        onScopeChange={onScopeChange}
      />
    );
  return (
    <>
      <ol aria-label="Log records">
        {records.map((log, index) => (
          <LogRow
            key={`${log.timestamp}:${log.spanId ?? ""}:${page}:${index}`}
            log={log}
            originMs={originMs}
            stepOf={scope === "service" ? stepOf : undefined}
            onSelectStep={onSelectStep}
          />
        ))}
      </ol>
      {page > 0 || total > LOG_PAGE_SIZE ? (
        <LogsPager page={page} total={total} setPage={setPage} />
      ) : null}
    </>
  );
};

const ToggleButton = ({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) => (
  <button
    type="button"
    aria-pressed={pressed}
    onClick={onClick}
    className={cn(
      "h-7 rounded-md px-3 text-xs",
      pressed
        ? "bg-card font-semibold text-high-emphasis shadow-sm"
        : "font-medium text-medium-emphasis hover:text-high-emphasis",
    )}
  >
    {children}
  </button>
);

/** The logs of the selected step, or of the whole service it ran in, inside the page. */
export const TraceStoryLogs = ({
  step,
  service,
  parent,
  originMs,
  requestId,
  stepOf,
  onSelectStep,
}: {
  step: FlowStep;
  service: string;
  parent?: FlowStep;
  originMs: number;
  requestId?: string;
  stepOf: (spanId?: string) => FlowStep | undefined;
  onSelectStep: (index: number) => void;
}) => {
  const [scope, setScope] = useState<LogScope>("step");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const span = step.span;
  const scopeLine =
    scope === "step"
      ? `trace ${span.traceId} · span ${span.spanId} · ${logServiceOf(step)}`
      : `trace ${span.traceId} · ${service}`;
  return (
    <section aria-label={`Logs of ${service}`} className="flex min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-2.5">
        <fieldset className="inline-flex rounded-lg bg-muted p-0.5">
          <legend className="sr-only">Which logs</legend>
          <ToggleButton pressed={scope === "step"} onClick={() => setScope("step")}>
            This step
          </ToggleButton>
          <ToggleButton pressed={scope === "service"} onClick={() => setScope("service")}>
            All of {service}
          </ToggleButton>
        </fieldset>
        <label className="ml-auto inline-flex items-center gap-1.5 text-xs text-medium-emphasis">
          <input
            type="checkbox"
            className="accent-primary"
            checked={errorsOnly}
            onChange={(event) => setErrorsOnly(event.target.checked)}
          />
          <span>Errors only</span>
        </label>
      </div>
      <div className="max-h-[560px] min-h-0 overflow-y-auto">
        <LogsBody
          key={`${scope}:${span.traceId}:${span.spanId}:${service}:${errorsOnly}:${requestId ?? ""}`}
          scope={scope}
          step={step}
          service={service}
          parent={parent}
          originMs={originMs}
          errorsOnly={errorsOnly}
          requestId={requestId}
          stepOf={stepOf}
          onSelectStep={(index) => {
            setScope("step");
            onSelectStep(index);
          }}
          onScopeChange={setScope}
        />
      </div>
      <p className="break-all border-t border-border px-5 py-2 font-mono text-[10px] text-low-emphasis">
        Times are from the start of the trace · matched by {scopeLine}
      </p>
    </section>
  );
};

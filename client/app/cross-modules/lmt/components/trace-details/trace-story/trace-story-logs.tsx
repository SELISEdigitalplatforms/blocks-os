import { useState } from "react";
import { Badge } from "@/components/ui-kits/badge/badge";
import { Button } from "@/components/ui-kits/button/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui-kits/sheet/sheet";
import { useGetLogs, useGetRestoredLogs } from "@blocks-lmt/hooks/use-log";
import type { IGetLogsPayload, ILog } from "@blocks-lmt/models/log.model";
import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import {
  getLogFormatTimestamp,
  getLogLevelBadgeVariant,
  getLogLevelLabel,
} from "@blocks-lmt/utils";
import { LogStackTrace } from "../../log-stack-trace";
import { logServiceOf } from "./trace-story.util";

export const LOG_PAGE_SIZE = 25;

export type LogScope = "step" | "trace";

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

const LogRow = ({
  log,
  stepOf,
  onSelectStep,
}: {
  log: ILog;
  stepOf?: (spanId?: string) => FlowStep | undefined;
  onSelectStep: (index: number) => void;
}) => {
  const step = stepOf?.(log.spanId);
  return (
    <li className="flex flex-col gap-1.5 border-b border-border px-5 py-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge
          variant={getLogLevelBadgeVariant(log.level)}
          className="w-[64px] shrink-0 py-0 text-[10px] uppercase tracking-wider"
        >
          {getLogLevelLabel(log.level)}
        </Badge>
        <time dateTime={log.timestamp} className="text-xs tabular-nums text-medium-emphasis">
          {getLogFormatTimestamp(log.timestamp)}
        </time>
        {log.serviceName ? (
          <span className="text-xs text-low-emphasis">{log.serviceName}</span>
        ) : null}
      </div>
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
          Step {step.index + 1} · {step.tag}
        </button>
      ) : null}
    </li>
  );
};

const buildLogsPayload = (
  scope: LogScope,
  step: FlowStep,
  serviceNames: string[],
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
    serviceName: serviceNames[0] ?? logServiceOf(step),
    serviceNames,
    filter: { traceId: span.traceId, ...level },
  };
};

const EmptyLogs = ({
  scope,
  step,
  parent,
  errorsOnly,
  onSelectStep,
  onScopeChange,
}: {
  scope: LogScope;
  step: FlowStep;
  parent?: FlowStep;
  errorsOnly: boolean;
  onSelectStep: (index: number) => void;
  onScopeChange: (scope: LogScope) => void;
}) => {
  const forStep = scope === "step";
  return (
    <div className="flex flex-col items-start gap-3 px-5 py-6 text-sm">
      <p className="font-semibold text-high-emphasis">
        {errorsOnly ? "No errors were logged here." : "No logs were written during this step."}
      </p>
      {forStep && !errorsOnly ? <p className="text-medium-emphasis">{emptyReason(step)}</p> : null}
      {forStep && parent ? (
        <Button size="sm" type="button" onClick={() => onSelectStep(parent.index)}>
          Show logs of step {parent.index + 1}
        </Button>
      ) : null}
      {forStep ? (
        <Button size="sm" variant="outline" type="button" onClick={() => onScopeChange("trace")}>
          Show logs of the whole trace
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
  parent,
  serviceNames,
  errorsOnly,
  requestId,
  stepOf,
  onSelectStep,
  onScopeChange,
}: {
  scope: LogScope;
  step: FlowStep;
  parent?: FlowStep;
  serviceNames: string[];
  errorsOnly: boolean;
  requestId?: string;
  stepOf: (spanId?: string) => FlowStep | undefined;
  onSelectStep: (index: number) => void;
  onScopeChange: (scope: LogScope) => void;
}) => {
  const [page, setPage] = useState(0);
  const payload = buildLogsPayload(scope, step, serviceNames, errorsOnly, page);
  const hasSpan = scope === "trace" || Boolean(step.span.spanId);
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
            stepOf={scope === "trace" ? stepOf : undefined}
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
    className={`rounded-md border px-2.5 py-1 text-xs ${pressed ? "border-primary bg-primary/10 text-high-emphasis" : "border-transparent text-medium-emphasis hover:bg-muted/50"}`}
  >
    {children}
  </button>
);

export const TraceStoryLogs = ({
  open,
  onOpenChange,
  step,
  parent,
  serviceNames,
  requestId,
  stepOf,
  onSelectStep,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: FlowStep;
  parent?: FlowStep;
  serviceNames: string[];
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
      : `trace ${span.traceId} · ${serviceNames.join(", ")}`;
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4 pr-12 text-left">
          <SheetTitle className="text-base">
            {scope === "step" ? `Logs · step ${step.index + 1}` : "Logs · whole trace"}
          </SheetTitle>
          <SheetDescription className="break-words text-xs">
            {scope === "step"
              ? step.tag
              : `Every record of this trace, from ${serviceNames.length} services`}
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-5 py-2">
          <ToggleButton pressed={scope === "step"} onClick={() => setScope("step")}>
            This step
          </ToggleButton>
          <ToggleButton pressed={scope === "trace"} onClick={() => setScope("trace")}>
            Whole trace
          </ToggleButton>
          <span className="ml-auto">
            <ToggleButton pressed={errorsOnly} onClick={() => setErrorsOnly(!errorsOnly)}>
              Errors only
            </ToggleButton>
          </span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <LogsBody
            key={`${scope}:${span.traceId}:${span.spanId}:${errorsOnly}:${requestId ?? ""}`}
            scope={scope}
            step={step}
            parent={parent}
            serviceNames={serviceNames}
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
          Matched by {scopeLine}
        </p>
      </SheetContent>
    </Sheet>
  );
};

import { useState } from "react";
import { ArrowDown, ArrowUpRight, Database, Clock3 } from "lucide-react";
import type { FlowStep } from "@blocks-lmt/utils/trace-flow.util";
import { formatDurationMs } from "@blocks-lmt/utils";

const privateKey = /authorization|cookie|password|secret|token|api.?key|x.?blocks.?key/i;
export const formatTraceValue = (value: unknown): string => {
  if (value === undefined || value === null || value === "") return "Not captured";
  if (typeof value === "object") {
    try {
      return (JSON.stringify(value, null, 2) ?? "Not captured").slice(0, 2000);
    } catch {
      return "[Unable to display value]";
    }
  }
  switch (typeof value) {
    case "string":
    case "number":
    case "boolean":
    case "bigint":
    case "symbol":
      return String(value).slice(0, 2000);
    default:
      return "Not captured";
  }
};

const transferLabel = (traffic: FlowStep["traffic"]) => {
  if (traffic === "data") return "Database operation";
  if (traffic === "message") return "Message transfer";
  return `${traffic} request`;
};

const Field = ({ label, value }: { label: string; value: unknown }) => (
  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b border-border/60 py-2 last:border-0">
    <dt className="break-words text-[10px] uppercase tracking-wider text-low-emphasis">{label}</dt>
    <dd className="break-words font-mono text-[12px] text-high-emphasis">
      {formatTraceValue(value)}
    </dd>
  </div>
);

const TransferFields = ({ step }: { step: FlowStep }) => {
  const span = step.span;
  const attrs = span.attributes ?? {};
  const fields: [string, unknown][] = [
    ["Operation", span.operationName],
    ["Service", span.serviceName],
    [
      "Request / destination",
      span.request?.url ||
        attrs["url.full"] ||
        attrs["http.url"] ||
        attrs["server.address"] ||
        attrs["messaging.destination.name"],
    ],
    ["Method", span.entryPoint?.method || attrs["http.request.method"] || attrs["http.method"]],
    [
      "Response status",
      span.response?.statusCode ||
        attrs["http.response.status_code"] ||
        attrs["response.status.code"],
    ],
    [
      "Data store / collection",
      attrs["db.collection.name"] ||
        attrs["db.mongodb.collection"] ||
        attrs["db.namespace"] ||
        attrs["db.name"],
    ],
    ["Span ID", step.spanId],
  ];
  return fields.map(([label, value]) => <Field key={label} label={label} value={value} />);
};

const AttributeFields = ({ step }: { step: FlowStep }) => {
  const entries = Object.entries(step.span.attributes ?? {});
  if (entries.length === 0)
    return (
      <p className="py-4 text-[12px] text-low-emphasis">
        No attributes were captured for this span.
      </p>
    );
  return (
    <>
      {entries.slice(0, 100).map(([key, value]) => (
        <Field key={key} label={key} value={privateKey.test(key) ? "[redacted]" : value} />
      ))}
    </>
  );
};

export const TraceFlowInspector = ({
  step,
  from,
  to,
}: {
  step: FlowStep;
  from: string;
  to: string;
}) => {
  const [tab, setTab] = useState<"Transfer" | "Attributes">("Transfer");
  return (
    <aside
      aria-label="Selected transfer"
      className="flex min-w-0 max-h-[490px] flex-col rounded-lg border border-border bg-background p-4"
    >
      <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.15em] text-low-emphasis">
        <span>Transfer inspector</span>
        <span>Span {step.index + 1}</span>
      </div>
      <h3 className="mt-3 break-words text-base font-semibold text-high-emphasis">{step.tag}</h3>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-medium-emphasis">
        <span className="flex items-center gap-1">
          <Clock3 size={12} />
          {formatDurationMs(step.durationMs)}
        </span>
        <span className={step.state === "error" ? "text-error" : "text-medium-emphasis"}>
          {step.statusLabel}
        </span>
      </div>
      <div className="my-4 rounded-md border border-border bg-muted/30 p-3 text-[12px]">
        <div className="flex items-center gap-2">
          <ArrowUpRight size={14} className="text-chart-purple" />
          <span className="truncate">{from}</span>
        </div>
        <div className="my-2 ml-1 flex items-center gap-2 text-low-emphasis">
          <ArrowDown size={14} />
          <span className="text-[10px] uppercase tracking-wider">
            {transferLabel(step.traffic)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Database size={14} className="text-chart-purple" />
          <span className="truncate">{to}</span>
        </div>
      </div>
      {step.errorMessage ? (
        <p className="mb-3 break-words rounded-md bg-error/10 p-2 text-[12px] text-error">
          {step.isErrorOrigin ? "Error started here: " : "Reported error: "}
          {step.errorMessage}
        </p>
      ) : null}
      <div className="flex border-b border-border" role="tablist" aria-label="Transfer details">
        {(["Transfer", "Attributes"] as const).map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={tab === name}
            onClick={() => setTab(name)}
            className={`px-3 py-2 text-[12px] ${tab === name ? "border-b-2 border-chart-purple font-semibold text-high-emphasis" : "text-low-emphasis"}`}
          >
            {name}
          </button>
        ))}
      </div>
      <dl className="min-h-0 flex-1 overflow-auto pt-1" role="tabpanel" aria-label={tab}>
        {tab === "Transfer" ? <TransferFields step={step} /> : <AttributeFields step={step} />}
      </dl>
      <p className="mt-auto pt-3 text-[10px] leading-relaxed text-low-emphasis">
        Shows recorded trace metadata. Request and response bodies are not inferred.
      </p>
    </aside>
  );
};

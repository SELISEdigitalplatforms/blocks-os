import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import { getLogFormatTimestamp, getLogLevelClassName } from "@blocks-lmt/utils";
import { ChevronRight } from "lucide-react";
import { useContext, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { LogsViewerContext } from "../logs-viewer/logs-viewer";
import { ILog } from "../../models/log.model";

export const LogItem = ({ log }: { log: ILog }) => {
  const { logsRouteServiceName, selectedService, useGenericTraceLinks, isSourceBlocks, services } =
    useContext(LogsViewerContext);
  const [searchParams] = useSearchParams();
  const [isTraceOpen, setIsTraceOpen] = useState(false);
  const stackTrace = log.exception?.trim() ?? "";
  const activeTab = searchParams.get("tab") ?? selectedService?.serviceName;
  const LMT_BASE_PATH = useLmtBasePath();
  const traceHref = log.traceId
    ? useGenericTraceLinks
      ? `${LMT_BASE_PATH}/tracing/${log.traceId}`
      : logsRouteServiceName
        ? `${LMT_BASE_PATH}/logs/${logsRouteServiceName}/trace/${log.traceId}${
            activeTab ? `?tab=${encodeURIComponent(activeTab)}` : ""
          }`
        : undefined
    : undefined;

  // Determine the display name for the service badge
  const serviceBadgeText = useMemo(() => {
    if (!log.serviceName) return "";
    if (isSourceBlocks) {
      // For blocks services, format like "iam-api" or "iam-worker"
      const nameParts = log.serviceName.split("-");
      // Remove any "blocks-" prefix if present
      const relevantParts = nameParts.filter((part) => part !== "blocks");
      return relevantParts.join("-");
    } else {
      // For managed services, find the service by serviceId (log.serviceName) and return its name
      const service = services.find((s) => s.serviceName === log.serviceName);
      return service?._raw?.name || log.serviceName;
    }
  }, [log.serviceName, isSourceBlocks, services]);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center gap-2">
        <div className="flex items-center gap-2">
          <span className="text-high-emphasis">{getLogFormatTimestamp(log.timestamp)}</span>
          {serviceBadgeText && <Badge variant="secondary">{serviceBadgeText}</Badge>}
          <span className={`text-sm uppercase ${getLogLevelClassName(log.level)}`}>
            {log.level}
          </span>
        </div>
        <div className="flex h-6 items-center">
          {traceHref ? (
            <CopyToClipboardButton textToCopy={log.traceId} isHoverable>
              <Link
                to={traceHref}
                className="text-warning-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`View trace details for ${log.traceId}`}
              >
                [{log.traceId}]
              </Link>
            </CopyToClipboardButton>
          ) : (
            <CopyToClipboardButton textToCopy={log.traceId} isHoverable>
              <span className="text-warning-700">[{log.traceId}]</span>
            </CopyToClipboardButton>
          )}
        </div>
      </div>
      <div
        className="whitespace-pre-wrap break-words text-left text-sm text-medium-emphasis"
        style={{ width: "calc(80vw - 120px)" }}
      >
        {log.message}
      </div>

      {stackTrace && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setIsTraceOpen((open) => !open)}
            aria-expanded={isTraceOpen}
            className="inline-flex items-center gap-1 rounded-sm text-xs font-medium text-error hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronRight
              aria-hidden="true"
              className={`h-3.5 w-3.5 transition-transform motion-reduce:transition-none ${
                isTraceOpen ? "rotate-90" : ""
              }`}
            />
            {isTraceOpen ? "Hide stack trace" : "Show stack trace"}
          </button>

          {isTraceOpen && (
            <div className="mt-2 rounded-sm border border-border bg-muted/40">
              <div className="flex items-center border-b border-border px-3 py-1.5">
                <CopyToClipboardButton textToCopy={stackTrace} label="Copy stack trace">
                  <span className="text-xs font-medium uppercase tracking-wide text-medium-emphasis">
                    Exception
                  </span>
                </CopyToClipboardButton>
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words px-3 py-2 text-xs leading-relaxed text-medium-emphasis">
                {stackTrace}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

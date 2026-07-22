import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import { getLogFormatTimestamp, getLogLevelClassName } from "@blocks-lmt/utils";
import { useContext, useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { LogsViewerContext } from "../logs-viewer/logs-viewer";
import { ILog } from "../../models/log.model";

export const LogItem = ({ log }: { log: ILog }) => {
  const {
    logsRouteServiceName,
    selectedService,
    useGenericTraceLinks,
    isSourceBlocks,
    services,
  } = useContext(LogsViewerContext);
  const [searchParams] = useSearchParams();
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
          <span className="text-high-emphasis">
            {getLogFormatTimestamp(log.timestamp)}
          </span>
          {serviceBadgeText && (
            <Badge variant="secondary">{serviceBadgeText}</Badge>
          )}
          <span
            className={`text-sm uppercase ${getLogLevelClassName(log.level)}`}>
            {log.level}
          </span>
        </div>
        <div className="flex h-6 items-center">
          {traceHref ? (
            <CopyToClipboardButton textToCopy={log.traceId} isHoverable>
              <Link
                to={traceHref}
                className="text-warning-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`View trace details for ${log.traceId}`}>
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
        style={{ width: "calc(80vw - 120px)" }}>
        {log.message}
      </div>
    </div>
  );
};

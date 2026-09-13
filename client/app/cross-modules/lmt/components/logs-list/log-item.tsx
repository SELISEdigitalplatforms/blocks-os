import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button";
import { Badge } from "@/components/ui-kits/badge/badge";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import { getLogFormatTimestamp, getLogLevelBadgeVariant, getLogLevelLabel } from "@blocks-lmt/utils";
import { useContext, useMemo } from "react";
import { Link, useSearchParams } from "react-router";
import { LogsViewerContext } from "../logs-viewer/logs-viewer";
import { LogStackTrace } from "../log-stack-trace";
import { ILog } from "../../models/log.model";

/** Joins the parts that are actually present, so neither a stray "?" nor "&&" reaches the URL. */
const buildQuery = (parts: string[]) => {
  const present = parts.filter(Boolean);
  return present.length ? `?${present.join("&")}` : "";
};

export const LogItem = ({ log }: { log: ILog }) => {
  const {
    logsRouteServiceName,
    selectedService,
    useGenericTraceLinks,
    isSourceBlocks,
    services,
    restoreRequestId,
  } = useContext(LogsViewerContext);
  const [searchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") ?? selectedService?.serviceName;
  const LMT_BASE_PATH = useLmtBasePath();
  // A restored row's trace lives only inside its own restore, so the link has to name the
  // request. Looked up without it, a month-old trace id finds nothing in hot storage.
  const restoreQuery = restoreRequestId
    ? `requestId=${encodeURIComponent(restoreRequestId)}`
    : "";
  const traceHref = log.traceId
    ? useGenericTraceLinks
      ? `${LMT_BASE_PATH}/tracing/${log.traceId}${restoreQuery ? `?${restoreQuery}` : ""}`
      : logsRouteServiceName
        ? `${LMT_BASE_PATH}/logs/${logsRouteServiceName}/trace/${log.traceId}${buildQuery([
            activeTab ? `tab=${encodeURIComponent(activeTab)}` : "",
            restoreQuery,
          ])}`
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
    <div className="flex flex-col gap-1.5">
      {/* Metadata reads as columns rather than a sentence: a fixed-width monospace timestamp
          and a fixed-width level chip line up down the list, so the eye can scan severity and
          time without re-reading each row. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="shrink-0 text-xs tabular-nums text-medium-emphasis">
          {getLogFormatTimestamp(log.timestamp)}
        </span>
        <Badge
          variant={getLogLevelBadgeVariant(log.level)}
          className="w-[84px] shrink-0 py-0 text-[10px] uppercase tracking-wider"
        >
          {getLogLevelLabel(log.level)}
        </Badge>
        {serviceBadgeText && (
          <Badge variant="secondary" className="shrink-0 py-0 text-[10px] font-medium">
            {serviceBadgeText}
          </Badge>
        )}
        <div className="flex min-w-0 items-center">
          {traceHref ? (
            <CopyToClipboardButton textToCopy={log.traceId} isHoverable>
              <Link
                to={traceHref}
                className="truncate text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={`View trace details for ${log.traceId}`}
              >
                {log.traceId}
              </Link>
            </CopyToClipboardButton>
          ) : (
            <CopyToClipboardButton textToCopy={log.traceId} isHoverable>
              <span className="truncate text-xs text-medium-emphasis">{log.traceId}</span>
            </CopyToClipboardButton>
          )}
        </div>
      </div>

      {/* Width comes from the container, not the viewport. The previous calc(80vw - 120px)
          ignored the actual column and was what forced the list to scroll sideways. */}
      <div className="whitespace-pre-wrap break-words text-left text-sm leading-relaxed text-high-emphasis">
        {log.message}
      </div>

      <LogStackTrace exception={log.exception} />
    </div>
  );
};

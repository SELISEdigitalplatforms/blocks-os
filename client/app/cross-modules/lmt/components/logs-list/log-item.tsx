import { CopyToClipboardButton } from "@/components/copy-to-clipboard-button"
import { LMT_BASE_PATH } from "@/constants/lmt-nav"
import { getLogFormatTimestamp, getLogLevelClassName } from "@blocks-lmt/utils"
import { useContext } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { LogsViewerContext } from "../logs-viewer/logs-viewer"
import { ILog } from "../../models/log.model"

export const LogItem = ({ log }: { log: ILog }) => {
  const { logsRouteServiceName, selectedService } = useContext(LogsViewerContext)
  const [searchParams] = useSearchParams()
  const activeTab = searchParams.get("tab") ?? selectedService?.serviceName
  const traceHref =
    log.traceId && logsRouteServiceName
      ? `${LMT_BASE_PATH}/logs/${logsRouteServiceName}/trace/${log.traceId}${
          activeTab ? `?tab=${encodeURIComponent(activeTab)}` : ""
        }`
      : undefined

  return (
    <div className="flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center">
        <div className="flex items-center gap-2">
          <span className="mr-2 text-high-emphasis">{getLogFormatTimestamp(log.timestamp)}</span>
          <span className={`mr-2 text-sm uppercase ${getLogLevelClassName(log.level)}`}>
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
    </div>
  )
}

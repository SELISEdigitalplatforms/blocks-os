import { TraceDetails } from "@blocks-lmt/components/trace-details"
import { useParams } from "react-router-dom"

export function LmtTraceDetailRoute() {
  const { traceId } = useParams<{ traceId: string }>()

  return (
    <div className="flex flex-col">
      <TraceDetails id={traceId ?? ""} breadcrumbIndex={4} />
    </div>
  )
}

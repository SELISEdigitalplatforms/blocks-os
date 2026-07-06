import { TraceDetails } from "@blocks-lmt/components/trace-details"
import { useParams } from "react-router-dom"

export function LmtTraceDetailRoute() {
  const { traceId } = useParams<{ traceId: string }>()

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      <TraceDetails id={traceId ?? ""} breadcrumbIndex={3} />
    </div>
  )
}

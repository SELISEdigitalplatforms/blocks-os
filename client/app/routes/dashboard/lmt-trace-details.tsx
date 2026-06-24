import { LMT_BASE_PATH } from "@/constants/lmt-nav"
import { Navigate, useParams } from "react-router-dom"

export default function LmtTraceDetailsRedirect() {
  const { traceId } = useParams<{ traceId: string }>()

  if (!traceId) {
    return <Navigate to={`${LMT_BASE_PATH}/tracing`} replace />
  }

  return <Navigate to={`${LMT_BASE_PATH}/tracing/${traceId}`} replace />
}

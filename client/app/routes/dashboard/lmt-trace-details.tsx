import { useLmtBasePath } from "@/hooks/use-scoped-path"
import { Navigate, useParams } from "react-router-dom"

export default function LmtTraceDetailsRedirect() {
  const { traceId } = useParams<{ traceId: string }>()
  const LMT_BASE_PATH = useLmtBasePath()

  if (!traceId) {
    return <Navigate to={`${LMT_BASE_PATH}/tracing`} replace />
  }

  return <Navigate to={`${LMT_BASE_PATH}/tracing/${traceId}`} replace />
}

import { Navigate, useParams } from "react-router-dom"

export default function LmtTraceDetailsRedirect() {
  const { traceId } = useParams<{ traceId: string }>()

  if (!traceId) {
    return <Navigate to="/services/lmt/tracing" replace />
  }

  return <Navigate to={`/services/lmt/tracing/${traceId}`} replace />
}

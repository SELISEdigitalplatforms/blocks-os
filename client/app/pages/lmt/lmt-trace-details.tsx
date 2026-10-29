import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import { Navigate, useParams } from "react-router";

export default function LmtTraceDetailsRedirect() {
  const { traceId } = useParams<{ traceId: string }>();
  const LMT_BASE_PATH = useLmtBasePath();

  if (!traceId) {
    return <Navigate to={`${LMT_BASE_PATH}/tracing`} replace />;
  }

  return <Navigate to={`${LMT_BASE_PATH}/tracing/${traceId}`} replace />;
}

import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { useLmtBasePath } from "@/hooks/use-scoped-path";
import { TraceDetails } from "@blocks-lmt/components/trace-details";
import { SERVICES } from "@blocks-lmt/constants/services.constant";
import { useMemo } from "react";
import { useParams } from "react-router-dom";

export function LmtServiceLogTraceRoute() {
  const { serviceName, traceId } = useParams<{
    serviceName: string;
    traceId: string;
  }>();
  const LMT_BASE_PATH = useLmtBasePath();

  // Try to find the base service (removing -api/-worker suffix if present)
  const service = useMemo(() => {
    const baseServiceName = serviceName?.replace(/-api$/, "").replace(/-worker$/, "");
    return SERVICES.find((item) => item.name === baseServiceName && item.showInLogs);
  }, [serviceName]);

  const id = traceId ?? "";

  BREADCRUMB_CUSTOM_TITLES[`${LMT_BASE_PATH}/logs`] = "Logs";
  if (serviceName) {
    BREADCRUMB_CUSTOM_TITLES[`${LMT_BASE_PATH}/logs/${serviceName}`] =
      service?.label ?? serviceName;
    BREADCRUMB_CUSTOM_TITLES[`${LMT_BASE_PATH}/logs/${serviceName}/trace`] = "Trace";
  }

  return (
    <div className="flex flex-col">
      <TraceDetails
        id={id}
        breadcrumbIndex={4}
        logsTraceBreadcrumbHref={
          serviceName && id
            ? `${LMT_BASE_PATH}/logs/${serviceName}/trace/${id}`
            : undefined
        }
      />
    </div>
  );
}

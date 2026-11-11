import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import { TraceDetails } from "@blocks-lmt/components/trace-details";
import { getServices } from "@blocks-lmt/constants/services.constant";
import { useMemo } from "react";
import { useParams } from "react-router";
import { useT } from "@seliseblocks/genesis-os";

export function LmtServiceLogTraceRoute() {
  const { serviceName, traceId } = useParams<{
    serviceName: string;
    traceId: string;
  }>();
  const LMT_BASE_PATH = useLmtBasePath();
  const { t } = useT("os.lmt");

  // Try to find the base service (removing -api/-worker suffix if present)
  const service = useMemo(() => {
    const baseServiceName = serviceName?.replace(/-api$/, "").replace(/-worker$/, "");
    return getServices().find((item) => item.name === baseServiceName && item.showInLogs);
  }, [serviceName]);

  const id = traceId ?? "";

  const breadcrumbTitles = {
    [`${LMT_BASE_PATH}/logs`]: t("LOGS.LOGS"),
    ...(serviceName
      ? {
          [`${LMT_BASE_PATH}/logs/${serviceName}`]: service?.label ?? serviceName,
          [`${LMT_BASE_PATH}/logs/${serviceName}/trace`]: t("SERVICE_LOG_TRACE.TRACE"),
        }
      : {}),
  };

  return (
    <div className="flex flex-col">
      <TraceDetails
        id={id}
        breadcrumbIndex={4}
        logsTraceBreadcrumbHref={
          serviceName && id ? `${LMT_BASE_PATH}/logs/${serviceName}/trace/${id}` : undefined
        }
        breadcrumbTitles={breadcrumbTitles}
      />
    </div>
  );
}

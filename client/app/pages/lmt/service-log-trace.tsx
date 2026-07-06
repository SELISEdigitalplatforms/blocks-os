import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { LMT_BASE_PATH } from "@/constants/lmt-nav";
import { TraceDetails } from "@blocks-lmt/components/trace-details";
import { SERVICES } from "@blocks-lmt/constants/services.constant";
import { useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";

export function LmtServiceLogTraceRoute() {
  const { serviceName, traceId } = useParams<{
    serviceName: string;
    traceId: string;
  }>();
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");

  const service = useMemo(
    () => SERVICES.find((item) => item.name === serviceName && item.showInLogs),
    [serviceName],
  );

  const id = traceId ?? "";
  const backHref = serviceName
    ? `${LMT_BASE_PATH}/logs/${serviceName}${tab ? `?tab=${encodeURIComponent(tab)}` : ""}`
    : `${LMT_BASE_PATH}/logs`;

  BREADCRUMB_CUSTOM_TITLES[`${LMT_BASE_PATH}/logs`] = "Logs";
  if (serviceName) {
    BREADCRUMB_CUSTOM_TITLES[`${LMT_BASE_PATH}/logs/${serviceName}`] =
      service?.label ?? serviceName;
    BREADCRUMB_CUSTOM_TITLES[`${LMT_BASE_PATH}/logs/${serviceName}/trace`] = null;
    if (id) {
      BREADCRUMB_CUSTOM_TITLES[
        `${LMT_BASE_PATH}/logs/${serviceName}/trace/${id}`
      ] = id;
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      <TraceDetails id={id} breadcrumbIndex={3} backHref={backHref} />
    </div>
  );
}

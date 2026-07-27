import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { BREADCRUMB_CUSTOM_TITLES } from "@/constants/breadcrumb-custom-title";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import {
  LOG_SERVICE_AI_DESCRIPTION,
  LOG_SERVICE_AI_QUERIES,
} from "@blocks-lmt/constants/logs-service-meta.constant";
import { getLmtLogCollections } from "@blocks-lmt/constants/logs-service-names.constant";
import { SERVICES } from "@blocks-lmt/constants/services.constant";
import { LogsViewer } from "@blocks-lmt/components";
import { useMemo } from "react";
import { useParams } from "react-router";

export function LmtServiceLogsRoute() {
  const { serviceName } = useParams<{ serviceName: string }>();
  const LMT_BASE_PATH = useLmtBasePath();

  const service = useMemo(
    () => SERVICES.find((item) => item.name === serviceName && item.showInLogs),
    [serviceName],
  );

  const logServices = useMemo(() => {
    if (!service) {
      return [];
    }

    const { api: apiServiceName, worker: workerServiceName } = getLmtLogCollections(
      service.serviceName,
    );

    return [
      {
        id: apiServiceName,
        label: "Api",
        serviceName: apiServiceName,
      },
      {
        id: workerServiceName,
        label: "Worker",
        serviceName: workerServiceName,
      },
    ];
  }, [service]);

  BREADCRUMB_CUSTOM_TITLES[`${LMT_BASE_PATH}/logs`] = "Logs";
  if (serviceName) {
    BREADCRUMB_CUSTOM_TITLES[`${LMT_BASE_PATH}/logs/${serviceName}`] =
      service?.label ?? serviceName;
  }

  if (!service) {
    return (
      <div className="flex flex-col gap-5 sm:gap-4">
        <PageBreadcrumb breadcrumbIndex={4} listClassName="text-base sm:text-lg" />
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Logs are not configured for this service.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      <PageBreadcrumb breadcrumbIndex={4} listClassName="text-base sm:text-lg" />
      <LogsViewer
        key={serviceName}
        logsRouteServiceName={serviceName}
        services={logServices}
        predefinedQueries={LOG_SERVICE_AI_QUERIES[service.name] ?? []}
        askAiDescription={LOG_SERVICE_AI_DESCRIPTION}
        agentName="Ask AI"
      />
    </div>
  );
}

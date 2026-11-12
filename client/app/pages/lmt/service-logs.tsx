import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { Card, CardContent } from "@/components/ui-kits/card/card";
import { useLmtBasePath } from "@/hooks/use-lmt-base-path";
import {
  getLogServiceAiDescription,
  LOG_SERVICE_AI_QUERIES,
} from "@blocks-lmt/constants/logs-service-meta.constant";
import { getLmtLogCollections } from "@blocks-lmt/constants/logs-service-names.constant";
import { getServices } from "@blocks-lmt/constants/services.constant";
import { LogsViewer } from "@blocks-lmt/components";
import { useMemo } from "react";
import { useParams } from "react-router";
import { useT } from "@seliseblocks/genesis-os";

export function LmtServiceLogsRoute() {
  const { t } = useT("os.lmt");
  const { serviceName } = useParams<{ serviceName: string }>();
  const LMT_BASE_PATH = useLmtBasePath();

  const service = useMemo(
    () => getServices().find((item) => item.name === serviceName && item.showInLogs),
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
        label: t("SERVICE_LOGS.API"),
        serviceName: apiServiceName,
      },
      {
        id: workerServiceName,
        label: t("SERVICE_LOGS.WORKER"),
        serviceName: workerServiceName,
      },
    ];
  }, [service, t]);

  const breadcrumbTitles = {
    [`${LMT_BASE_PATH}/logs`]: t("LOGS.LOGS"),
    ...(serviceName
      ? { [`${LMT_BASE_PATH}/logs/${serviceName}`]: service?.label ?? serviceName }
      : {}),
  };

  if (!service) {
    return (
      <div className="flex flex-col gap-5 sm:gap-4">
        <PageBreadcrumb breadcrumbIndex={4} customTitles={breadcrumbTitles} />
        <Card>
          <CardContent className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            {t("SERVICE_LOGS.LOGS_ARE_NOT_CONFIGURED_FOR")}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-4">
      <PageBreadcrumb breadcrumbIndex={4} customTitles={breadcrumbTitles} />
      <LogsViewer
        key={serviceName}
        logsRouteServiceName={serviceName}
        services={logServices}
        predefinedQueries={LOG_SERVICE_AI_QUERIES[service.name] ?? []}
        askAiDescription={getLogServiceAiDescription()}
      />
    </div>
  );
}

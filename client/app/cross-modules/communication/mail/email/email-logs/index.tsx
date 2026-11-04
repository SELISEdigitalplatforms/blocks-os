import React from "react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { LogsViewer } from "@blocks-lmt/components";
import { useT } from "@seliseblocks/genesis-os";

export function EmailLogs() {
  const { t } = useT("os.communication.mail");
  const breadcrumbTitles = {
    "/email-management": t("EMAIL_LOGS.BREADCRUMB_EMAIL_MANAGEMENT"),
    "/email-management/logs": t("EMAIL_LOGS.BREADCRUMB_LOGS"),
  };
  return (
    <div>
      <PageBreadcrumb breadcrumbIndex={2} customTitles={breadcrumbTitles} />
      <LogsViewer
        services={[
          {
            id: "blocks-communication-api",
            label: t("EMAIL_LOGS.SERVICE_API"),
            serviceName: "blocks-communication-api",
          },
          {
            id: "blocks-communication-worker",
            label: t("EMAIL_LOGS.SERVICE_WORKER"),
            serviceName: "blocks-communication-worker",
          },
        ]}
        predefinedQueries={[
          t("EMAIL_LOGS.QUERY_EMAIL_ISSUES"),
          t("EMAIL_LOGS.QUERY_ERRORS_LAST_HOUR"),
          t("EMAIL_LOGS.QUERY_ERRORS_LAST_HOUR"),
        ]}
      />
    </div>
  );
}

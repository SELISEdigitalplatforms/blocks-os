import React from "react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { LogsViewer } from "@blocks-lmt/components";

const BREADCRUMB_TITLES = {
  "/email-management": "Email Management",
  "/email-management/logs": "Logs",
};

export function EmailLogs() {
  return (
    <div>
      <PageBreadcrumb breadcrumbIndex={2} customTitles={BREADCRUMB_TITLES} />
      <LogsViewer
        services={[
          {
            id: "blocks-communication-api",
            label: "Api",
            serviceName: "blocks-communication-api",
          },
          {
            id: "blocks-communication-worker",
            label: "Worker",
            serviceName: "blocks-communication-worker",
          },
        ]}
        predefinedQueries={[
          "Has anyone faced any email issues?",
          "Any errors in the last hour?",
          "Any errors in the last hour?",
        ]}
      />
    </div>
  );
}

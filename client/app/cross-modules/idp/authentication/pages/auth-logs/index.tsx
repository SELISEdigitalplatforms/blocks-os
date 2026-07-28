import React from "react";
import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { LogsViewer } from "@blocks-lmt/components";

const BREADCRUMB_TITLES = {
  "/app/idp": "Authentication",
  "/app/idp/logs": "Logs",
};

export function AuthLogs() {
  return (
    <div>
      <PageBreadcrumb breadcrumbIndex={2} customTitles={BREADCRUMB_TITLES} />
      <LogsViewer
        services={[
          {
            id: "blocks-idp-api",
            label: "Api",
            serviceName: "blocks-idp-api",
          },
          {
            id: "blocks-idp-api",
            label: "Worker",
            serviceName: "blocks-idp-worker",
          },
        ]}
        predefinedQueries={[
          "What unusual log patterns appeared in the past 24 hours?",
          "Any errors in the last hour?",
          "Has anyone faced any authentication issues?",
        ]}
      />
    </div>
  );
}

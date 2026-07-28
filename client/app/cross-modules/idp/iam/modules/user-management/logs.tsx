import PageBreadcrumb from "@/components/breadcrumb/breadcrumb";
import { LogsViewer } from "@blocks-lmt/components";

const BREADCRUMB_TITLES = {
  "/services/iam": "IAM",
  "/services/iam/logs": "Logs",
};

export function IamLogs() {
  return (
    <div>
      <PageBreadcrumb breadcrumbIndex={2} customTitles={BREADCRUMB_TITLES} />
      <LogsViewer
        services={[
          {
            id: "blocks-idp-api",
            label: "API",
            serviceName: "blocks-idp-api",
          },
          {
            id: "blocks-idp-worker",
            label: "Worker",
            serviceName: "blocks-idp-worker",
          },
        ]}
        predefinedQueries={[
          "Show recent IAM user-management errors.",
          "Were there unusual permission or role update failures today?",
          "Any spikes in user provisioning issues over the last 24 hours?",
        ]}
      />
    </div>
  );
}

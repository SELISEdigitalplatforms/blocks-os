import type { LogServiceRow } from "@blocks-lmt/models/log-entry.model"

export const DUMMY_LOG_SERVICES: LogServiceRow[] = [
  {
    id: "blocks-iam",
    name: "blocks-iam",
    routeSlug: "iam",
    description: "Identity and access management service logs.",
    status: "running",
  },
  {
    id: "blocks-os",
    name: "blocks-os",
    routeSlug: "os",
    description: "Platform core and workspace service logs.",
    status: "running",
  },
  {
    id: "blocks-monitor",
    name: "blocks-monitor",
    routeSlug: "monitor",
    description: "Monitoring and observability service logs.",
    status: "running",
  },
]

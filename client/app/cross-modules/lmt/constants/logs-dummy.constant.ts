import type { LogServiceRow } from "@blocks-lmt/models/log-entry.model"

export const DUMMY_LOG_SERVICES: LogServiceRow[] = [
  {
    id: "blocks-iam",
    name: "Blocks IAM",
    routeSlug: "iam",
    description:
      "Identity and access management service logs. Monitor authentication flows, role assignments, and permission audits.",
    status: "running",
  },
  {
    id: "blocks-os",
    name: "Blocks OS",
    routeSlug: "os",
    description:
      "Platform core and workspace service logs. Essential kernel processes, resource management, and workspace orchestration.",
    status: "running",
  },
  {
    id: "blocks-monitor",
    name: "Blocks Monitor",
    routeSlug: "monitor",
    description:
      "Monitoring and observability service logs. Trace visualization engine, alerting triggers, and metric aggregation pipelines.",
    status: "running",
  },
]

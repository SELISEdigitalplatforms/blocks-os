import type { LogServiceRow } from "@blocks-lmt/models/log-entry.model";
import type { LucideIcon } from "lucide-react";
import {
  Bot,
  Database,
  Languages,
  LineChart,
  Network,
  Palette,
  Rocket,
  Shield,
  Wrench,
  Workflow,
} from "lucide-react";

export const LOG_SERVICE_ICONS = {
  iam: Shield,
  os: Network,
  monitor: LineChart,
  localization: Languages,
  data: Database,
  logic: Workflow,
  release: Rocket,
  utilities: Wrench,
  studio: Palette,
  agent: Bot,
} satisfies Record<LogServiceRow["icon"], LucideIcon>;

export const LOG_SERVICES: LogServiceRow[] = [
  {
    id: "blocks-iam",
    name: "Blocks IAM",
    routeSlug: "iam",
    icon: "iam",
    description:
      "Sign-in, token, role, and permission activity. Use these logs to audit access changes and troubleshoot auth issues.",
    status: "running",
  },
  {
    id: "blocks-os",
    name: "Blocks OS",
    routeSlug: "os",
    icon: "os",
    description:
      "Core platform and workspace operations. Follow tenancy, orchestration, and shared infrastructure events.",
    status: "running",
  },
  {
    id: "blocks-monitor",
    name: "Blocks Monitor",
    routeSlug: "monitor",
    icon: "monitor",
    description:
      "Metrics, alerts, and trace collection pipelines. Spot ingestion failures and observability gaps quickly.",
    status: "running",
  },
  {
    id: "blocks-localization",
    name: "Blocks Localization",
    routeSlug: "localization",
    icon: "localization",
    description:
      "Translation and locale delivery logs. Track string updates, regional rollouts, and i18n job failures.",
    status: "running",
  },
  {
    id: "blocks-data",
    name: "Blocks Data",
    routeSlug: "data",
    icon: "data",
    description:
      "Storage, sync, and data pipeline logs. Debug queries, migrations, and background data jobs.",
    status: "running",
  },
  {
    id: "blocks-release",
    name: "Blocks Release",
    routeSlug: "release",
    icon: "release",
    description:
      "Build, promote, and deploy events across environments. Trace release progress and rollout errors.",
    status: "running",
  },
  {
    id: "blocks-utilities",
    name: "Blocks Utilities",
    routeSlug: "utilities",
    icon: "utilities",
    description:
      "Shared helper services and cross-cutting jobs. Inspect platform tooling runs and utility API calls.",
    status: "running",
  },
  {
    id: "blocks-studio",
    name: "Blocks Studio",
    routeSlug: "studio",
    icon: "studio",
    description:
      "Builder and workspace editing logs. Monitor asset processing, publishing flows, and studio-side errors.",
    status: "running",
  },
  {
    id: "blocks-agent",
    name: "Blocks Agent",
    routeSlug: "agent",
    icon: "agent",
    description:
      "AI agent orchestration and tool-call logs. Trace prompt flows, model invocations, and agent-side failures.",
    status: "running",
  },
];
